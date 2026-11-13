import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-stream';
import { fromBuffer } from 'yauzl';

export const ARCHIVE_LIMIT = 32 * 1024 * 1024;
export const EXPANDED_LIMIT = 128 * 1024 * 1024;
export type ArchiveFormat = 'tar.gz' | 'zip';

/** Read only expected release members. Never extract archive paths onto the filesystem. */
export async function readReleaseArchive(
  bytes: Buffer,
  format: ArchiveFormat,
  directory: string,
  executable: string,
  signal: AbortSignal,
  expandedLimit = EXPANDED_LIMIT,
): Promise<{ binary: Buffer; licence: Buffer }> {
  if (bytes.length > ARCHIVE_LIMIT)
    throw new Error('Highwater archive exceeds the download limit.');
  const seen = new Set<string>();
  const files = new Map<string, Buffer>();
  let total = 0;
  let entries = 0;
  function member(name: string, isDirectory: boolean, size: number) {
    signal.throwIfAborted();
    if (++entries > 16 || !Number.isSafeInteger(size) || size < 0 || size > expandedLimit)
      throw new Error('Highwater archive exceeds the expanded size or entry limit.');
    if (
      name.includes('\\') ||
      name.startsWith('/') ||
      name.split('/').some((p) => p === '.' || p === '..')
    )
      throw new Error('Unsafe path in Highwater archive.');
    if (seen.has(name)) throw new Error('Duplicate member in Highwater archive.');
    seen.add(name);
    if (isDirectory) {
      if (name !== directory && name !== directory + '/')
        throw new Error('Unexpected archive directory.');
      if (size !== 0) throw new Error('Non-empty archive directory.');
      return;
    }
    if (
      ![executable, 'LICENSE', 'README.md', 'CHANGELOG.md'].some(
        (file) => name === directory + '/' + file,
      )
    )
      throw new Error('Unexpected member in Highwater archive.');
  }
  async function consume(name: string, stream: AsyncIterable<unknown>) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      signal.throwIfAborted();
      if (!Buffer.isBuffer(chunk)) throw new Error('Invalid archive stream.');
      total += chunk.length;
      if (total > expandedLimit)
        throw new Error('Highwater archive exceeds the expanded size limit.');
      if (name === directory + '/' + executable || name === directory + '/LICENSE')
        chunks.push(Buffer.from(chunk));
    }
    if (chunks.length) files.set(name, Buffer.concat(chunks));
  }
  if (format === 'tar.gz') {
    const parser = extract();
    let expanded = 0;
    parser.on('entry', (header, stream, next) => {
      void (async () => {
        if (header.type !== 'file' && header.type !== 'directory')
          throw new Error('Links and special files are forbidden in Highwater archives.');
        member(header.name, header.type === 'directory', header.size ?? 0);
        await consume(header.name, stream);
        next();
      })().catch((error) => parser.destroy(error));
    });
    await pipeline(
      Readable.from([bytes]),
      createGunzip(),
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          expanded += chunk.length;
          callback(
            expanded > expandedLimit
              ? new Error('Highwater archive exceeds the expanded size limit.')
              : null,
            chunk,
          );
        },
      }),
      parser,
      { signal },
    );
  } else {
    await new Promise<void>((resolve, reject) => {
      fromBuffer(
        bytes,
        { lazyEntries: true, strictFileNames: true, validateEntrySizes: true },
        (error, zip) => {
          if (error) {
            reject(error);
            return;
          }
          let settled = false;
          let active: Readable | undefined;
          const abort = () => fail(signal.reason);
          const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            active?.destroy(error);
            zip.close();
            reject(error);
          };
          zip.on('error', fail);
          zip.once('end', () => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            zip.close();
            resolve();
          });
          signal.addEventListener('abort', abort, { once: true });
          zip.on('entry', (entry) => {
            try {
              const kind = (entry.externalFileAttributes >>> 16) & 0xf000;
              if (entry.generalPurposeBitFlag & 1 || ![0, 0x8000, 0x4000].includes(kind))
                throw new Error('Encrypted entries, links and special files are forbidden.');
              const isDirectory = entry.fileName.endsWith('/');
              if ((kind === 0x4000 && !isDirectory) || (isDirectory && kind === 0x8000))
                throw new Error('Invalid archive member type.');
              member(entry.fileName, isDirectory, entry.uncompressedSize);
              zip.openReadStream(entry, (error, stream) => {
                if (error || !stream) {
                  fail(error ?? new Error('Missing archive stream.'));
                  return;
                }
                active = stream;
                void consume(entry.fileName, stream)
                  .then(() => {
                    active = undefined;
                    if (!settled) zip.readEntry();
                  })
                  .catch(fail);
              });
            } catch (error) {
              fail(error as Error);
            }
          });
          if (signal.aborted) abort();
          else zip.readEntry();
        },
      );
    });
  }
  signal.throwIfAborted();
  const binary = files.get(directory + '/' + executable);
  const licence = files.get(directory + '/LICENSE');
  if (!binary?.length || !licence?.length)
    throw new Error('Highwater archive is missing its executable or licence.');
  return { binary, licence };
}
