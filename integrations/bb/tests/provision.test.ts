import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { lstat, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { pack } from 'tar-stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinaryProvisioner, pinnedRelease, type BinaryRelease } from '../host/provision';
import { readReleaseArchive } from '../host/archive';
import { HighwaterProcess } from '../host/process';
import { binaries, tempDirectory, writePi, expectedVersion } from './helpers';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const signal = () => new AbortController().signal;
const dirs: string[] = [];
const processes: HighwaterProcess[] = [];
afterEach(async () => {
  for (const p of processes.splice(0)) await p.dispose();
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function directory() {
  const d = await tempDirectory();
  dirs.push(d);
  return d;
}
async function tar(
  files: { name: string; data?: Buffer; type?: 'file' | 'directory' | 'symlink' }[],
) {
  const archive = pack();
  const chunks: Buffer[] = [];
  const done = (async () => {
    for await (const chunk of archive) {
      if (!Buffer.isBuffer(chunk)) throw new Error('Invalid fixture stream');
      chunks.push(chunk);
    }
    return gzipSync(Buffer.concat(chunks));
  })();
  for (const f of files)
    archive.entry(
      {
        name: f.name,
        type: f.type ?? 'file',
        linkname: f.type === 'symlink' ? '../escape' : undefined,
      },
      f.data ?? Buffer.alloc(0),
    );
  archive.finalize();
  return done;
}
// Minimal stored ZIP writer for independent archive fixtures, not production extraction.
function zip(files: { name: string; data: Buffer; mode?: number }[]) {
  const locals: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    let crc = 0xffffffff;
    for (const byte of f.data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const name = Buffer.from(f.name),
      header = Buffer.alloc(30),
      record = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE((crc ^ 0xffffffff) >>> 0, 14);
    header.writeUInt32LE(f.data.length, 18);
    header.writeUInt32LE(f.data.length, 22);
    header.writeUInt16LE(name.length, 26);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(0x314, 4);
    record.writeUInt16LE(20, 6);
    header.copy(record, 8, 6, 28);
    record.writeUInt32LE(((f.mode ?? 0x81a4) * 65536) >>> 0, 38);
    record.writeUInt32LE(offset, 42);
    locals.push(header, name, f.data);
    central.push(record, name);
    offset += header.length + name.length + f.data.length;
  }
  const records = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(records.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, records, end]);
}
async function fixture(
  version = '0.5.1',
  platform = 'linux-x64',
  bytes = Buffer.from('synthetic executable'),
  archiveFormat = 'tar.gz',
) {
  const release = structuredClone(pinnedRelease);
  release.version = version;
  const root = `highwater-${version}-test-target`;
  const executable = platform.startsWith('win32') ? 'highwater.exe' : 'highwater';
  const licence = Buffer.from('MIT License\nSynthetic test fixture\n');
  const files = [
    { name: root + '/' + executable, data: bytes },
    { name: root + '/LICENSE', data: licence },
  ];
  const archive = archiveFormat === 'zip' ? zip(files) : await tar(files);
  release.platforms[platform as keyof typeof release.platforms] = {
    target: 'test-target',
    format: archiveFormat,
    archiveSha256: sha(archive),
    archiveBytes: archive.length,
    binarySha256: sha(bytes),
    binaryBytes: bytes.length,
    licenceSha256: sha(licence),
  };
  return { release, archive, bytes, root, executable };
}
function downloader(bytes: Buffer) {
  return vi.fn<typeof fetch>().mockImplementation(async () => new Response(new Uint8Array(bytes)));
}
function provisioner(home: string, release: BinaryRelease, fetcher: typeof fetch, extra = {}) {
  return new BinaryProvisioner(home, {
    platform: 'linux',
    arch: 'x64',
    release,
    fetcher,
    ...extra,
  });
}

describe('binary provisioning', () => {
  it.each(['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'])(
    'selects and caches %s without consulting PATH',
    async (platform) => {
      const home = await directory();
      const f = await fixture(
        '0.5.1',
        platform,
        undefined,
        platform.startsWith('win32') ? 'zip' : 'tar.gz',
      );
      const fetcher = downloader(f.archive);
      const [os, arch] = platform.split('-');
      const p = provisioner(home, f.release, fetcher, { platform: os, arch });
      const paths = await Promise.all(Array.from({ length: 4 }, () => p.get(signal())));
      expect(new Set(paths).size).toBe(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(await readFile(paths[0])).toEqual(f.bytes);
      expect(await readFile(join(paths[0], '..', 'LICENSE'), 'utf8')).toContain('MIT');
      fetcher.mockRejectedValue(new Error('offline'));
      expect(await p.get(signal())).toBe(paths[0]);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect((await lstat(paths[0])).isFile()).toBe(true);
    },
  );
  it('rejects unsupported platforms without a request', async () => {
    const fetcher = downloader(Buffer.alloc(0));
    const p = provisioner(await directory(), pinnedRelease, fetcher, {
      platform: 'linux',
      arch: 'arm',
    });
    await expect(p.get(signal())).rejects.toThrow('No pinned Highwater binary');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects corrupt archives, binary digests, licence digests, sizes and unsuccessful HTTP responses', async () => {
    for (const kind of [
      'archive',
      'binary',
      'licence',
      'truncated',
      'oversize',
      'http',
      'header',
    ]) {
      const f = await fixture();
      const spec = f.release.platforms['linux-x64'];
      let data = f.archive;
      if (kind === 'archive') spec.archiveSha256 = '0'.repeat(64);
      if (kind === 'binary') spec.binarySha256 = '0'.repeat(64);
      if (kind === 'licence') spec.licenceSha256 = '0'.repeat(64);
      if (kind === 'truncated') data = data.subarray(0, data.length - 1);
      if (kind === 'oversize') data = Buffer.concat([data, Buffer.alloc(1)]);
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(new Uint8Array(data), {
          status: kind === 'http' ? 404 : 200,
          headers: kind === 'header' ? { 'content-length': '999999999' } : {},
        }),
      );
      const home = await directory();
      await expect(provisioner(home, f.release, fetcher).get(signal())).rejects.toThrow(
        'could not be provisioned',
      );
      expect(await readdir(home)).toEqual([]);
    }
  });
  it('only follows bounded HTTPS redirects to release asset hosts', async () => {
    const f = await fixture();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://release-assets.githubusercontent.com/fixture' },
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array(f.archive)));
    await provisioner(await directory(), f.release, fetcher).get(signal());
    expect(fetcher.mock.calls[1][0]).toBe('https://release-assets.githubusercontent.com/fixture');
    for (const url of [
      'http://github.com/file',
      'https://example.com/file',
      'https://user:password@github.com/file',
      'https://github.com:444/file',
    ]) {
      const bad = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 302, headers: { location: url } }));
      await expect(provisioner(await directory(), f.release, bad).get(signal())).rejects.toThrow(
        'Untrusted',
      );
      expect(bad).toHaveBeenCalledTimes(1);
    }
    const loop = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://github.com/again' } }),
      );
    await expect(provisioner(await directory(), f.release, loop).get(signal())).rejects.toThrow(
      'redirect limit',
    );
    expect(loop).toHaveBeenCalledTimes(4);
  });
  it('bounds response and body waits, and cancels on worker disposal', async () => {
    const f = await fixture();
    const never = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    await expect(
      provisioner(await directory(), f.release, never, { timeoutMs: 20 }).get(signal()),
    ).rejects.toThrow('timed out');
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream));
    const controller = new AbortController();
    const work = provisioner(await directory(), f.release, fetcher).get(controller.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    controller.abort();
    await expect(work).rejects.toThrow();
    await vi.waitFor(() => expect(cancelled).toBe(true));
  });
  it('joins staging cleanup when the worker lifetime is cancelled', async () => {
    const home = await directory();
    const f = await fixture();
    const owner = new AbortController();
    let entered = false;
    const p = provisioner(home, f.release, downloader(f.archive), {
      validate: async (_path: string, _version: string, signal: AbortSignal) => {
        entered = true;
        await new Promise<void>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        );
      },
    });
    const work = p.get(owner.signal);
    await vi.waitFor(() => expect(entered).toBe(true));
    owner.abort();
    await expect(work).rejects.toThrow();
    expect(
      (await readdir(join(home, 'binaries', '0.5.1'))).filter((name) =>
        name.startsWith('.install-'),
      ),
    ).toEqual([]);
  });
  it('rechecks cached bytes and repairs corruption; symlinks are never executed', async () => {
    const home = await directory();
    const f = await fixture();
    const fetcher = downloader(f.archive);
    const p = provisioner(home, f.release, fetcher);
    const path = await p.get(signal());
    await writeFile(path, Buffer.alloc(f.bytes.length));
    await p.get(signal());
    expect(fetcher).toHaveBeenCalledTimes(2);
    if (process.platform !== 'win32') {
      const external = join(home, 'untouched');
      await writeFile(external, 'keep');
      await rm(path);
      await symlink(external, path);
      await p.get(signal());
      expect(await readFile(external, 'utf8')).toBe('keep');
      expect((await lstat(path)).isSymbolicLink()).toBe(false);
    }
  });
  it('does not fall back to an older cached release when the pinned release fails', async () => {
    const home = await directory();
    const old = await fixture();
    await provisioner(home, old.release, downloader(old.archive)).get(signal());
    const latest = await fixture('0.5.2');
    await expect(
      provisioner(
        home,
        latest.release,
        vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
      ).get(signal()),
    ).rejects.toThrow('could not be provisioned');
    await expect(
      provisioner(home, latest.release, downloader(latest.archive), {
        validate: async () => {
          throw new Error('bad executable version');
        },
      }).get(signal()),
    ).rejects.toThrow('could not be provisioned');
    const contents = await readdir(join(home, 'binaries', '0.5.2'));
    expect(contents.some((n) => n.startsWith('.install-'))).toBe(false);
  });
  it('automatically provisions and starts a real binary with no Highwater on PATH; one cancelled caller does not cancel another', async () => {
    const home = await directory();
    await writePi(home);
    const platform = `${process.platform}-${process.arch}`;
    const f = await fixture(
      expectedVersion,
      platform,
      await readFile(binaries[binaries.length - 1]),
    );
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      await gate;
      return new Response(new Uint8Array(f.archive));
    });
    const p = new HighwaterProcess({
      dataDir: join(home, 'data'),
      home,
      env: { PATH: join(home, 'no-tools') },
      provisioning: { release: f.release, fetcher },
    });
    processes.push(p);
    const abort = new AbortController();
    const first = p.get(null, abort.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const second = p.get(null);
    abort.abort();
    await expect(first).rejects.toThrow();
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(false);
    release();
    const server = await second;
    expect(server.version).toBe(expectedVersion);
    expect((await fetch(server.baseUrl + '/api/sessions')).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await p.get(null);
    expect(fetcher).toHaveBeenCalledTimes(1);
    // An explicit filename must never be mistaken for the automatic-provisioning choice.
    if (process.platform !== 'win32')
      expect(await p.status('<managed>')).toEqual({ state: 'missing' });
  });
});

describe('archive safety', () => {
  it.each(['../escape', '/absolute', 'root/../escape', 'root\\escape', 'other/highwater'])(
    'rejects unsafe or unexpected tar paths: %s',
    async (name) => {
      await expect(
        readReleaseArchive(
          await tar([{ name, data: Buffer.from('x') }]),
          'tar.gz',
          'root',
          'highwater',
          signal(),
        ),
      ).rejects.toThrow();
    },
  );
  it('rejects links, duplicates, missing executables and decompression beyond the bound', async () => {
    for (const entries of [
      [{ name: 'root/highwater', type: 'symlink' as const }],
      [
        { name: 'root/highwater', data: Buffer.from('a') },
        { name: 'root/highwater', data: Buffer.from('b') },
      ],
      [{ name: 'root/LICENSE', data: Buffer.from('MIT') }],
    ])
      await expect(
        readReleaseArchive(await tar(entries), 'tar.gz', 'root', 'highwater', signal()),
      ).rejects.toThrow();
    await expect(
      readReleaseArchive(
        await tar([{ name: 'root/highwater', data: Buffer.alloc(1024) }]),
        'tar.gz',
        'root',
        'highwater',
        signal(),
        100,
      ),
    ).rejects.toThrow('expanded');
    for (const name of ['../escape', '/absolute', 'root/../escape', 'root\\escape'])
      await expect(
        readReleaseArchive(
          zip([{ name, data: Buffer.from('x') }]),
          'zip',
          'root',
          'highwater.exe',
          signal(),
        ),
      ).rejects.toThrow();
    await expect(
      readReleaseArchive(
        zip([{ name: 'root/highwater.exe', data: Buffer.from('x'), mode: 0xa1ff }]),
        'zip',
        'root',
        'highwater.exe',
        signal(),
      ),
    ).rejects.toThrow();
  });
});
