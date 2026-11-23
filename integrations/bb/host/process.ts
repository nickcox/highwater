import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import semver from 'semver';
import type { HostStatus } from '../contract';
import { BinaryProvisioner, pinnedRelease, type ProvisionOptions } from './provision';
import { HostFailure, waitFor, type HighwaterServer } from './http';

export interface ProcessOptions {
  dataDir: string;
  home?: string;
  env?: NodeJS.ProcessEnv;
  legacyPi?: boolean;
  startTimeoutMs?: number;
  probeTimeoutMs?: number;
  stopGraceMs?: number;
  now?: () => number;
  provisioning?: ProvisionOptions;
}
export class ProcessUnavailable extends HostFailure {
  constructor(public readonly state: Exclude<HostStatus, { state: 'ready' }>) {
    super(
      503,
      state.state === 'missing' ? 'binaryMissing' : state.state,
      state.state === 'missing' ? 'Highwater is not installed on this machine.' : state.message,
    );
  }
}
async function directory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
    throw error;
  }
}

export class HighwaterProcess {
  private readonly env: NodeJS.ProcessEnv;
  private readonly home: string;
  private readonly lifetime = new AbortController();
  private child: ChildProcess | null = null;
  private running:
    (HighwaterServer & { child: ChildProcess; controller: AbortController; key: string }) | null =
    null;
  private tail: Promise<unknown> = Promise.resolve();
  private stopping = new WeakMap<ChildProcess, Promise<void>>();
  private generation = 0;
  private binary: string | null | undefined;
  private failures = 0;
  private failedAt = 0;
  private lastFailure = '';
  private closed = false;
  private readonly provisioner: BinaryProvisioner;

  constructor(private readonly options: ProcessOptions) {
    this.env = options.env ?? process.env;
    this.home = options.home ?? homedir();
    this.provisioner = new BinaryProvisioner(options.dataDir, {
      ...options.provisioning,
      validate: async (path, version, signal) => {
        const found = await this.probe(path, signal);
        if (found !== version)
          throw new Error(`Downloaded Highwater reports ${found}, not pinned version ${version}.`);
      },
    });
  }
  get pid(): number | undefined {
    return this.child?.pid;
  }

  get(binaryPath: string | null, signal?: AbortSignal): Promise<HighwaterServer> {
    const work = this.tail.then(() => {
      signal?.throwIfAborted();
      return this.ensure(binaryPath?.trim() || null);
    });
    this.tail = work.catch(() => {});
    return waitFor(work, signal);
  }
  async status(binaryPath: string | null, signal?: AbortSignal): Promise<HostStatus> {
    try {
      return { state: 'ready', version: (await this.get(binaryPath, signal)).version };
    } catch (error) {
      if (signal?.aborted) throw error;
      return error instanceof ProcessUnavailable
        ? error.state
        : { state: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  }
  private get providerPiRoot(): string {
    return join(this.options.dataDir, '..', '..', 'provider-pi', 'bridge-data', 'sessions');
  }
  private get legacyPiRoot(): string {
    return join(this.home, '.bb', 'pi-bridge-sessions');
  }
  async hasLegacyPiFallback(): Promise<boolean> {
    return (
      !this.env.BB_PI_BRIDGE_SESSION_DIR?.trim() &&
      (await directory(this.providerPiRoot)) &&
      (await directory(this.legacyPiRoot))
    );
  }
  private async roots(): Promise<string[]> {
    const pi =
      this.env.BB_PI_BRIDGE_SESSION_DIR?.trim() ||
      (!this.options.legacyPi && (await directory(this.providerPiRoot))
        ? this.providerPiRoot
        : this.legacyPiRoot);
    const empty = join(this.options.dataDir, 'empty-pi-sessions');
    let piRoot = pi;
    if (!(await directory(pi))) {
      await mkdir(empty, { recursive: true });
      piRoot = empty;
    }
    const args = ['--session-root', piRoot];
    if (this.options.legacyPi) return args;
    const claude = join(this.env.CLAUDE_CONFIG_DIR || join(this.home, '.claude'), 'projects');
    const codex = this.env.CODEX_HOME || join(this.home, '.codex');
    if (await directory(claude)) args.push('--claude-root', claude);
    if (await directory(codex)) args.push('--codex-home', codex);
    return args;
  }
  private async ensure(override: string | null): Promise<HighwaterServer> {
    if (this.closed)
      throw new HostFailure(503, 'processStopped', 'The Highwater host has been disposed.');
    const choice = override;
    if (choice !== this.binary) {
      this.binary = choice;
      this.failures = 0;
      await this.stopCurrent();
    }
    const args = await this.roots();
    const key = JSON.stringify([choice, args]);
    if (
      this.running?.key === key &&
      this.running.child.exitCode === null &&
      this.running.child.signalCode === null
    )
      return this.running;
    await this.stopCurrent();
    const now = (this.options.now ?? Date.now)();
    if (this.failures >= 3 && now - this.failedAt < 60_000) {
      throw new ProcessUnavailable({
        state: 'failed',
        message: `${this.lastFailure} Retry after 60 seconds, or change the binary path.`,
      });
    }
    try {
      const expected = (this.options.provisioning?.release ?? pinnedRelease).version;
      if (!override) {
        const installed = await this.startFromPath(args, expected, key);
        if (installed) {
          this.failures = 0;
          return installed;
        }
      }
      const binary = override ?? (await this.provisioner.get(this.lifetime.signal));
      const found = await this.probe(binary);
      // An explicit override may be any version; the Context tab says when it differs from the pin.
      if (!override && found !== expected)
        throw new Error(`Cached Highwater reports ${found}, not pinned version ${expected}.`);
      if (this.closed) throw new Error('The Highwater host has been disposed.');
      const server = await this.start(binary, args, found, key);
      this.failures = 0;
      return server;
    } catch (error) {
      if (error instanceof ProcessUnavailable && error.state.state !== 'failed') throw error;
      this.failures += 1;
      this.failedAt = (this.options.now ?? Date.now)();
      this.lastFailure = error instanceof Error ? error.message : String(error);
      throw new ProcessUnavailable({ state: 'failed', message: this.lastFailure });
    }
  }
  private async startFromPath(
    args: string[],
    minimumVersion: string,
    key: string,
  ): Promise<HighwaterServer | null> {
    const windows = process.platform === 'win32';
    const path = windows
      ? Object.entries(this.env).find(([name]) => name.toLowerCase() === 'path')?.[1]
      : this.env.PATH;
    const executable = windows ? 'highwater.exe' : 'highwater';
    for (const entry of path?.split(delimiter) ?? []) {
      if (!entry) continue;
      const binary = resolve(windows ? entry.replace(/^"(.*)"$/, '$1') : entry, executable);
      try {
        if (!(await stat(binary)).isFile()) continue;
        await access(binary, constants.X_OK);
      } catch {
        continue;
      }
      // Check the first executable in PATH order, as a normal command lookup would.
      try {
        const found = await this.probe(binary);
        this.lifetime.signal.throwIfAborted();
        return semver.gte(found, minimumVersion)
          ? await this.start(binary, args, found, key)
          : null;
      } catch {
        this.lifetime.signal.throwIfAborted();
        return null;
      }
    }
    return null;
  }
  private probe(binary: string, external?: AbortSignal): Promise<string> {
    const signal = external
      ? AbortSignal.any([this.lifetime.signal, external])
      : this.lifetime.signal;
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const child = execFile(
        binary,
        ['--version'],
        {
          env: this.env,
          windowsHide: true,
          timeout: this.options.probeTimeoutMs ?? 5000,
          // A read-only version probe needs no graceful server shutdown. Hard-kill it on
          // timeout, excess output or disposal so an ignored SIGTERM cannot orphan it.
          killSignal: 'SIGKILL',
          maxBuffer: 16 * 1024,
        },
        (error, stdout) => {
          signal.removeEventListener('abort', abort);
          if (error) {
            reject(
              (error as NodeJS.ErrnoException).code === 'ENOENT'
                ? new ProcessUnavailable({ state: 'missing' })
                : error,
            );
            return;
          }
          const match = /^highwater (\S+)\s*$/.exec(stdout);
          if (!match || !semver.valid(match[1])) {
            reject(new Error('Highwater returned an invalid version string.'));
            return;
          }
          resolve(match[1]);
        },
      );
      // execFile's AbortSignal handling can use SIGTERM independently of killSignal.
      // Kill the read-only probe explicitly and let its exit settle the pending operation.
      const abort = () => {
        child.kill('SIGKILL');
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  private start(
    binary: string,
    args: string[],
    version: string,
    key: string,
  ): Promise<HighwaterServer> {
    return new Promise((resolve, reject) => {
      const child = spawn(binary, ['serve', '--port', '0', ...args], {
        env: this.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;
      const controller = new AbortController();
      let stderr = '';
      let stdout = '';
      let settled = false;
      const timer = setTimeout(
        () => fail('Highwater did not announce a listening port before startup timed out.'),
        this.options.startTimeoutMs ?? 10_000,
      );
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void this.stopChild(child).then(
          () => reject(new Error(`${message}${stderr ? `\n${stderr}` : ''}`)),
          reject,
        );
      };
      child.stderr!.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString())
          .slice(-32 * 1024)
          .split(/\r?\n/)
          .slice(-20)
          .map((line) => line.slice(-512))
          .join('\n');
      });
      child.stdout!.on('data', (chunk: Buffer) => {
        stdout = (stdout + chunk.toString()).slice(-32 * 1024);
        const match = /(?:^|\n)Listening on http:\/\/127\.0\.0\.1:(\d+)\r?\n/.exec(stdout);
        if (!match || settled) return;
        const port = Number(match[1]);
        if (port < 1 || port > 65535) {
          fail('Highwater announced an invalid port.');
          return;
        }
        settled = true;
        clearTimeout(timer);
        const running = {
          baseUrl: `http://127.0.0.1:${port}`,
          generation: ++this.generation,
          version,
          pid: child.pid!,
          signal: controller.signal,
          controller,
          child,
          key,
        };
        this.running = running;
        resolve(running);
      });
      child.once('error', (error) => fail(error.message));
      child.once('exit', (code, signal) => {
        controller.abort();
        if (this.running?.child === child) this.running = null;
        if (this.child === child) this.child = null;
        fail(`Highwater exited before startup (code ${code}, signal ${signal}).`);
      });
    });
  }
  private stopChild(child: ChildProcess): Promise<void> {
    const pending = this.stopping.get(child);
    if (pending) return pending;
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined)
      return Promise.resolve();
    const work = new Promise<void>((resolve) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), this.options.stopGraceMs ?? 2000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
    this.stopping.set(child, work);
    return work;
  }
  private async stopCurrent(): Promise<void> {
    this.running?.controller.abort();
    this.running = null;
    if (this.child) await this.stopChild(this.child);
  }
  async dispose(): Promise<void> {
    this.closed = true;
    this.lifetime.abort();
    await this.stopCurrent();
    await this.tail;
  }
}
