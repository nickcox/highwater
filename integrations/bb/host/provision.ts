import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import pinned from './binary-release.json';
import { ARCHIVE_LIMIT, readReleaseArchive } from './archive';
import { waitFor } from './http';

export type BinaryRelease = typeof pinned;
export interface ProvisionOptions {
  platform?: string;
  arch?: string;
  release?: BinaryRelease;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  validate?: (path: string, version: string, signal: AbortSignal) => Promise<void>;
}

const allowedHosts = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
]);
export const pinnedRelease: BinaryRelease = pinned;
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Only the pinned release's digests are trusted, including for cached files. */
export class BinaryProvisioner {
  private readonly pending = new Map<string, Promise<string>>();
  constructor(
    private readonly dataDir: string,
    private readonly options: ProvisionOptions = {},
  ) {}

  // This signal belongs to the worker lifetime, not an individual RPC caller.
  async get(signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const platform = `${this.options.platform ?? process.platform}-${this.options.arch ?? process.arch}`;
    const release = this.options.release ?? pinnedRelease;
    if (!(platform in release.platforms))
      throw new Error(
        `No pinned Highwater binary is available for ${platform}. Set Highwater binary to an explicit executable.`,
      );
    const key = JSON.stringify([this.dataDir, platform, release]);
    let work = this.pending.get(key);
    if (!work) {
      work = this.ensure(platform, release, signal);
      this.pending.set(key, work);
      void work
        .finally(() => {
          if (this.pending.get(key) === work) this.pending.delete(key);
        })
        .catch(() => {});
    }
    // Join cleanup on lifetime cancellation before the worker exits.
    return work;
  }
  private paths(platform: string, release: BinaryRelease) {
    const asset = release.platforms[platform as keyof typeof release.platforms];
    if (
      !/^\d+\.\d+\.\d+$/.test(release.version) ||
      !/^[a-z0-9_-]+$/.test(asset.target) ||
      ![asset.archiveSha256, asset.binarySha256, asset.licenceSha256].every((h) =>
        /^[a-f0-9]{64}$/.test(h),
      ) ||
      !Number.isSafeInteger(asset.archiveBytes) ||
      asset.archiveBytes < 1 ||
      asset.archiveBytes > ARCHIVE_LIMIT ||
      !Number.isSafeInteger(asset.binaryBytes) ||
      asset.binaryBytes < 1 ||
      asset.binaryBytes > 128 * 1024 * 1024 ||
      !['tar.gz', 'zip'].includes(asset.format)
    )
      throw new Error('Invalid pinned Highwater release metadata.');
    const executable = platform.startsWith('win32-') ? 'highwater.exe' : 'highwater';
    const directory = `highwater-${release.version}-${asset.target}`;
    const parent = join(this.dataDir, 'binaries', release.version);
    const destination = join(parent, `${asset.target}-${asset.binarySha256}`);
    return {
      asset,
      executable,
      directory,
      parent,
      destination,
      binary: join(destination, executable),
    };
  }
  private async verifyFile(
    path: string,
    expected: string,
    signal: AbortSignal,
    size?: number,
  ): Promise<boolean> {
    try {
      const info = await lstat(path);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 128 * 1024 * 1024 ||
        (size !== undefined && info.size !== size)
      )
        return false;
      const hash = createHash('sha256');
      let total = 0;
      for await (const chunk of createReadStream(path, { signal })) {
        total += chunk.length;
        if (total > 128 * 1024 * 1024) return false;
        hash.update(chunk);
      }
      return hash.digest('hex') === expected;
    } catch (error) {
      if (signal.aborted) throw error;
      if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes((error as NodeJS.ErrnoException).code ?? ''))
        return false;
      throw error;
    }
  }
  private async cached(
    platform: string,
    release: BinaryRelease,
    signal: AbortSignal,
  ): Promise<string | null> {
    const paths = this.paths(platform, release);
    try {
      for (const directory of [join(this.dataDir, 'binaries'), paths.parent, paths.destination]) {
        const info = await lstat(directory);
        if (!info.isDirectory() || info.isSymbolicLink()) return null;
      }
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return null;
      throw error;
    }
    if (
      !(await this.verifyFile(
        paths.binary,
        paths.asset.binarySha256,
        signal,
        paths.asset.binaryBytes,
      )) ||
      !(await this.verifyFile(
        join(paths.destination, 'LICENSE'),
        paths.asset.licenceSha256,
        signal,
      ))
    )
      return null;
    await chmod(paths.binary, 0o700);
    return paths.binary;
  }
  private async ensure(
    platform: string,
    release: BinaryRelease,
    signal: AbortSignal,
  ): Promise<string> {
    const current = await this.cached(platform, release, signal);
    if (current) return current;
    const bounded = AbortSignal.any([
      signal,
      AbortSignal.timeout(this.options.timeoutMs ?? 20_000),
    ]);
    try {
      return await this.install(platform, release, bounded);
    } catch (error) {
      signal.throwIfAborted();
      const detail = bounded.aborted
        ? 'The download or installation timed out.'
        : error instanceof Error
          ? error.message
          : String(error);
      throw new Error(
        `Highwater could not be provisioned. ${detail} Check internet access and Retry, or set Highwater binary to an explicit executable.`,
      );
    }
  }
  private async download(url: string, bytes: number, signal: AbortSignal): Promise<Buffer> {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const target = new URL(url);
      if (
        target.protocol !== 'https:' ||
        !allowedHosts.has(target.hostname) ||
        target.username ||
        target.password ||
        (target.port && target.port !== '443')
      )
        throw new Error('Untrusted Highwater download URL.');
      const response = await waitFor(
        (this.options.fetcher ?? fetch)(target.href, { signal, redirect: 'manual' }),
        signal,
      );
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location || redirects === 3)
          throw new Error('Highwater download exceeded the redirect limit.');
        url = new URL(location, target).href;
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error(`Highwater download returned HTTP ${response.status}.`);
      }
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) !== bytes)) {
        await response.body.cancel();
        throw new Error('Highwater download has an unexpected size.');
      }
      const reader = response.body.getReader();
      let total = 0;
      const chunks: Buffer[] = [];
      try {
        for (;;) {
          signal.throwIfAborted();
          const result = await waitFor(reader.read(), signal);
          if (result.done) break;
          total += result.value.byteLength;
          if (total > bytes || total > ARCHIVE_LIMIT)
            throw new Error('Highwater download exceeds the pinned size.');
          chunks.push(Buffer.from(result.value));
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (total !== bytes) throw new Error('Highwater download is incomplete.');
      return Buffer.concat(chunks, total);
    }
    throw new Error('Highwater download exceeded the redirect limit.');
  }
  private async install(
    platform: string,
    release: BinaryRelease,
    signal: AbortSignal,
  ): Promise<string> {
    const paths = this.paths(platform, release);
    const url = `https://github.com/nickcox/highwater/releases/download/v${release.version}/${paths.directory}.${paths.asset.format}`;
    const archive = await this.download(url, paths.asset.archiveBytes, signal);
    if (sha(archive) !== paths.asset.archiveSha256)
      throw new Error('Highwater archive checksum did not match the pinned release.');
    const result = await readReleaseArchive(
      archive,
      paths.asset.format as 'zip' | 'tar.gz',
      paths.directory,
      paths.executable,
      signal,
    );
    if (
      result.binary.length !== paths.asset.binaryBytes ||
      sha(result.binary) !== paths.asset.binarySha256 ||
      sha(result.licence) !== paths.asset.licenceSha256
    )
      throw new Error('Highwater executable or licence checksum did not match the pinned release.');
    for (const directory of [join(this.dataDir, 'binaries'), paths.parent]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error('Unsafe Highwater cache directory.');
    }
    const stage = await mkdtemp(join(paths.parent, '.install-'));
    let quarantine: string | undefined;
    try {
      for (const [name, bytes, mode] of [
        [paths.executable, result.binary, 0o700],
        ['LICENSE', result.licence, 0o600],
      ] as const) {
        const file = await open(join(stage, name), 'wx', mode);
        try {
          await file.writeFile(bytes, { signal });
          await file.sync();
        } finally {
          await file.close();
        }
      }
      await waitFor(
        this.options.validate?.(join(stage, paths.executable), release.version, signal) ??
          Promise.resolve(),
        signal,
      );
      signal.throwIfAborted();
      const concurrent = await this.cached(platform, release, signal);
      if (concurrent) return concurrent;
      try {
        quarantine = paths.destination + '.invalid-' + randomUUID();
        await rename(paths.destination, quarantine);
      } catch (error) {
        quarantine = undefined;
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      try {
        await rename(stage, paths.destination);
      } catch (error) {
        if (!(await this.cached(platform, release, signal))) throw error;
      }
      return paths.binary;
    } finally {
      await rm(stage, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      if (quarantine) await rm(quarantine, { recursive: true, force: true });
    }
  }
}
