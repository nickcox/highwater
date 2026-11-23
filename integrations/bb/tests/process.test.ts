import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighwaterProcess } from '../host/process';
import { pinnedRelease } from '../host/provision';
import { binaries, claudeFixtures, tempDirectory, writePi, expectedVersion } from './helpers';

const processes: HighwaterProcess[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const process of processes.splice(0)) await process.dispose();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function setup(options: Partial<ConstructorParameters<typeof HighwaterProcess>[0]> = {}) {
  const home = await tempDirectory();
  directories.push(home);
  const value = new HighwaterProcess({
    home,
    dataDir: join(home, 'data'),
    env: { PATH: process.env.PATH },
    ...options,
  });
  processes.push(value);
  return { home, value };
}
async function executable(home: string, body: string) {
  const path = join(home, 'fake-highwater');
  await writeFile(path, `#!${process.execPath}\n${body}\n`);
  await chmod(path, 0o700);
  return path;
}

describe.each(binaries)('real process: %s', (binary) => {
  it('starts once for concurrent calls, restarts after exit and stops on disposal', async () => {
    const { home, value } = await setup();
    await writePi(home);
    const servers = await Promise.all(Array.from({ length: 5 }, () => value.get(binary)));
    expect(new Set(servers.map((server) => server.pid)).size).toBe(1);
    const first = servers[0];
    expect((await fetch(first.baseUrl + '/api/sessions')).status).toBe(200);
    process.kill(first.pid, 'SIGTERM');
    await expect.poll(() => first.signal.aborted).toBe(true);
    const restarted = await value.get(binary);
    expect(restarted.pid).not.toBe(first.pid);
    expect(restarted.generation).toBeGreaterThan(first.generation);
    await value.dispose();
    expect(restarted.signal.aborted).toBe(true);
    expect(() => process.kill(restarted.pid, 0)).toThrow();
  });
  it('uses a placeholder to suppress default sources, then restarts when the real Pi root appears', async () => {
    const { home, value } = await setup();
    await claudeFixtures(home);
    const initial = await value.get(binary);
    const list = (await (await fetch(initial.baseUrl + '/api/sessions')).json()) as {
      sessions: { harness: string }[];
    };
    expect(list.sessions.length).toBeGreaterThan(0);
    expect(list.sessions.every((session) => session.harness === 'claude-code')).toBe(true);
    await writePi(home);
    const next = await value.get(binary);
    expect(next.pid).not.toBe(initial.pid);
    expect(initial.signal.aborted).toBe(true);
    const updated = (await (await fetch(next.baseUrl + '/api/sessions')).json()) as {
      sessions: { fileName: string }[];
    };
    expect(updated.sessions.some((session) => session.fileName === 'probe-main.jsonl')).toBe(true);
  });
});

describe('process states', () => {
  it.each([
    ['matching', expectedVersion],
    ['newer', '0.0.1'],
  ])('uses a %s executable from PATH and gives an explicit override precedence', async (_, pin) => {
    const env = { PATH: '' };
    const fetcher = vi.fn<typeof fetch>();
    const { home, value } = await setup({
      env,
      provisioning: { release: { ...pinnedRelease, version: pin }, fetcher },
    });
    env.PATH = home;
    const path = join(home, process.platform === 'win32' ? 'highwater.exe' : 'highwater');
    await copyFile(binaries[0], path);
    await chmod(path, 0o700);
    const server = await value.get(null);
    expect(server.version).toBe(expectedVersion);
    expect((await fetch(server.baseUrl + '/api/sessions')).status).toBe(200);
    expect((await value.get(null)).pid).toBe(server.pid);
    expect(await value.status(join(home, 'missing-override'))).toEqual({ state: 'missing' });
    expect(server.signal.aborted).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reports missing binaries and supports explicit overrides', async () => {
    const { home, value } = await setup();
    expect(await value.status(join(home, 'does-not-exist'))).toEqual({ state: 'missing' });
    expect(await value.status(binaries[0])).toMatchObject({
      state: 'ready',
      version: expectedVersion,
    });
    const pid = value.pid;
    expect(await value.status(join(home, 'also-missing'))).toEqual({ state: 'missing' });
    expect(() => process.kill(pid!, 0)).toThrow();
  });
  it.skipIf(process.platform === 'win32')(
    'runs an explicit binary of another version and rejects malformed versions',
    async () => {
      const { home, value } = await setup();
      const path = await executable(
        home,
        `if (process.argv.includes('--version')) console.log('highwater 0.99.0');
else require('node:http').createServer().listen(0, '127.0.0.1', function () {
  console.log('Listening on http://127.0.0.1:' + this.address().port);
});`,
      );
      expect(await value.status(path)).toEqual({ state: 'ready', version: '0.99.0' });
      expect(value.pid).toBeDefined();
      const malformed = join(home, 'malformed-highwater');
      await writeFile(malformed, `#!${process.execPath}\nconsole.log("not a version");\n`);
      await chmod(malformed, 0o700);
      expect(await value.status(malformed)).toMatchObject({ state: 'failed' });
    },
  );
  it.skipIf(process.platform === 'win32')(
    'bounds startup output and backs off after three failed starts',
    async () => {
      let now = 0;
      const { home, value } = await setup({ now: () => now });
      const counter = join(home, 'starts');
      const path = await executable(
        home,
        `
      if (process.argv.includes('--version')) console.log('highwater ${expectedVersion}');
      else {
        require('node:fs').appendFileSync(${JSON.stringify(counter)}, 'start\\n');
        for (let i = 0; i < 30; i++) console.error('failure ' + i);
        process.exit(2);
      }
    `,
      );
      for (let i = 0; i < 4; i++) {
        const status = await value.status(path);
        expect(status.state).toBe('failed');
        if (status.state === 'failed') {
          expect(status.message).toContain('failure 29');
          expect(status.message).not.toContain('failure 0\n');
        }
      }
      expect((await readFile(counter, 'utf8')).trim().split('\n')).toHaveLength(3);
      now = 60_001;
      await value.status(path);
      expect((await readFile(counter, 'utf8')).trim().split('\n')).toHaveLength(4);
    },
  );
  it.skipIf(process.platform === 'win32')(
    'times out silent startups and force-stops a child that ignores SIGTERM',
    async () => {
      const { home, value } = await setup({ startTimeoutMs: 300, stopGraceMs: 75 });
      const path = await executable(
        home,
        `
      if (process.argv.includes('--version')) console.log('highwater ${expectedVersion}');
      else { process.on('SIGTERM', () => process.stderr.write('ignoring SIGTERM\\n')); setInterval(() => {}, 1000); }
    `,
      );
      const status = await value.status(path);
      expect(status).toMatchObject({ state: 'failed' });
      if (status.state === 'failed') {
        expect(status.message).toContain('startup timed out');
        expect(status.message).toContain('ignoring SIGTERM');
      }
      expect(value.pid).toBeUndefined();
    },
  );
  it.skipIf(process.platform === 'win32')(
    'does not leave a version probe alive after timeout or disposal',
    async () => {
      const { home, value } = await setup({ probeTimeoutMs: 1000 });
      const pidFile = join(home, 'probe-pid');
      const path = await executable(
        home,
        `
      require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      process.on('SIGTERM', () => {});
      setInterval(() => {}, 1000);
    `,
      );
      expect(await value.status(path)).toMatchObject({ state: 'failed' });
      const timedOutPid = Number(await readFile(pidFile, 'utf8'));
      expect(() => process.kill(timedOutPid, 0)).toThrow();
      await rm(pidFile);
      const pending = value.status(path);
      await expect.poll(async () => readFile(pidFile, 'utf8').catch(() => '')).toMatch(/^\d+$/);
      const cancelledPid = Number(await readFile(pidFile, 'utf8'));
      await value.dispose();
      expect(await pending).toMatchObject({ state: 'failed' });
      await expect
        .poll(() => {
          try {
            process.kill(cancelledPid, 0);
            return true;
          } catch {
            return false;
          }
        })
        .toBe(false);
    },
  );

  it('resolves custom session folders from the supplied host environment', async () => {
    const home = await tempDirectory();
    directories.push(home);
    await writePi(home);
    await mkdir(join(home, 'custom-claude/projects'), { recursive: true });
    const { value } = await setup({
      home,
      env: {
        PATH: process.env.PATH,
        BB_PI_BRIDGE_SESSION_DIR: join(home, '.bb/pi-bridge-sessions'),
        CLAUDE_CONFIG_DIR: join(home, 'custom-claude'),
        CODEX_HOME: join(home, 'missing-codex'),
      },
    });
    const server = await value.get(binaries[0]);
    const listed = (await (await fetch(server.baseUrl + '/api/sessions')).json()) as {
      sessions: { fileName: string }[];
    };
    expect(listed.sessions.some((session) => session.fileName === 'probe-main.jsonl')).toBe(true);
  });
});
