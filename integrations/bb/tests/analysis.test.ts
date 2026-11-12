import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Analyses, type AnalysisEntry } from '../host/analysis';
import { matchesEtag, waitFor } from '../host/http';
import { analysis, deferred, response, testServer } from './helpers';

const stores: Analyses[] = [];
function store(options: ConstructorParameters<typeof Analyses>[0] = {}) {
  const value = new Analyses(options);
  stores.push(value);
  return value;
}
afterEach(() => {
  for (const value of stores.splice(0)) value.dispose();
});
function entry(key: string, bytes = 60): AnalysisEntry {
  return {
    key,
    bytes: Buffer.alloc(bytes),
    etag: '"test"',
    summary: {
      callCount: 0,
      compactionCount: 0,
      latestInputTokens: null,
      peakInputTokens: null,
      series: [],
      partial: false,
    },
  };
}
function join(value: Analyses, opened: ReturnType<Analyses['open']>): Buffer {
  const pieces = [Buffer.from(opened.firstPiece, 'base64')];
  for (let i = 1; i < opened.pieceCount; i++) {
    const piece = value.read(opened.transferId, i);
    expect('piece' in piece).toBe(true);
    if ('piece' in piece) pieces.push(Buffer.from(piece.piece, 'base64'));
  }
  return Buffer.concat(pieces);
}

describe('analysis loading and transfers', () => {
  it('shares concurrent analysis and summary work, compresses and splits within the wire limit', async () => {
    const pending = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    const value = store({ fetcher, pieceBytes: 9 });
    const one = value.load(testServer(), 'one');
    const two = value.load(testServer(), 'one');
    pending.resolve(response(analysis()));
    const result = await one;
    expect(await two).toBe(result);
    expect(result.summary).toMatchObject({ latestInputTokens: 15, peakInputTokens: 30 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const opened = value.open(result);
    expect(opened.pieceCount).toBeGreaterThan(1);
    expect(Buffer.from(opened.firstPiece, 'base64').length).toBeLessThanOrEqual(9);
    expect(JSON.parse(gunzipSync(join(value, opened)).toString())).toEqual(analysis());
    expect(value.close(opened.transferId)).toEqual({ closed: true });
    expect(value.close(opened.transferId)).toEqual({ closed: true });
    expect(value.read(opened.transferId, 0)).toEqual({ expired: true });
  });
  it('revalidates every load, reuses 304 results, and retains an immutable active transfer on replacement', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(analysis()))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(response(analysis([70, 80]), '"v2"'));
    const value = store({ fetcher, pieceBytes: 10 });
    const first = await value.load(testServer(), 'one');
    const opened = value.open(first);
    expect(await value.load(testServer(), 'one')).toBe(first);
    const replacement = await value.load(testServer(), 'one');
    expect(replacement.etag).toBe('"v2"');
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ 'If-None-Match': '"v1"' });
    expect(JSON.parse(gunzipSync(join(value, opened)).toString())).toEqual(analysis());
    expect(matchesEtag('"v1", "v2"', replacement.etag)).toBe(true);
    expect(matchesEtag('"v1"', replacement.etag)).toBe(false);
  });
  it('does not cancel shared work when one caller stops waiting', async () => {
    const pending = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    const value = store({ fetcher });
    const controller = new AbortController();
    const first = waitFor(value.load(testServer(), 'one'), controller.signal);
    const cancelled = expect(first).rejects.toBe('cancelled');
    const other = value.load(testServer(), 'one');
    controller.abort('cancelled');
    await cancelled;
    pending.resolve(response(analysis()));
    expect((await other).summary.callCount).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('evicts catalogue cache entries after two sessions without invalidating active transfers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(analysis()));
    const value = store({ fetcher });
    const opened = value.open(await value.load(testServer(), 'one'));
    await value.load(testServer(), 'two');
    await value.load(testServer(), 'three');
    await value.load(testServer(), 'one');
    expect(fetcher.mock.calls[3][1]?.headers).toEqual({});
    expect(JSON.parse(gunzipSync(join(value, opened)).toString())).toEqual(analysis());
    await value.load(testServer(2), 'one');
    expect(fetcher.mock.calls[4][1]?.headers).toEqual({});
    expect(value.read(opened.transferId, 0)).toHaveProperty('piece');
  });
  it('enforces expiry, shared memory budgets and immutable versions of the same session', () => {
    let now = 0;
    const value = store({ memoryBytes: 100, now: () => now, transferTtlMs: 50 });
    const first = entry('1:one', 40);
    const one = value.open(first);
    value.open(first); // Shared buffers are counted once.
    const two = value.open(entry('1:one', 40));
    expect(() => value.open(entry('1:three', 40))).toThrow(
      'Other analyses are still being transferred',
    );
    expect(value.read(one.transferId, 0)).toHaveProperty('piece');
    value.close(two.transferId);
    expect(() => value.open(entry('1:three', 40))).not.toThrow();
    now = 51;
    expect(value.read(one.transferId, 0)).toEqual({ expired: true });
    expect(() => value.open(entry('1:large', 101))).toThrow(
      'exceeds the host transfer memory limit',
    );
  });
  it('releases transfers on disposal and rejects new loads', async () => {
    const value = store();
    const opened = value.open(entry('1:one'));
    value.dispose();
    expect(value.read(opened.transferId, 0)).toEqual({ expired: true });
    await expect(value.load(testServer(), 'one')).rejects.toMatchObject({ code: 'processStopped' });
  });
  it('passes through Highwater errors and rejects missing ETags, invalid JSON, schemas and uncached 304s', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'SESSION_PARSE_FAILED', message: 'source session is invalid' },
          }),
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('not json', { headers: { etag: '"x"' } }))
      .mockResolvedValueOnce(response({ ...analysis(), schemaVersion: 42 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const value = store({ fetcher });
    await expect(value.load(testServer(), 'one')).rejects.toMatchObject({
      httpStatus: 422,
      code: 'SESSION_PARSE_FAILED',
      message: 'source session is invalid',
    });
    for (let i = 0; i < 4; i++)
      await expect(value.load(testServer(), 'one')).rejects.toMatchObject({
        code: 'analysisInvalid',
      });
  });
  it('bounds uncompressed and compressed response sizes while reading and compressing', async () => {
    const uncompressed = store({
      uncompressedBytes: 10,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(response(analysis())),
    });
    await expect(uncompressed.load(testServer(), 'one')).rejects.toMatchObject({
      httpStatus: 413,
      code: 'analysisTooLarge',
    });
    const compressed = store({
      compressedBytes: 1,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(response(analysis())),
    });
    await expect(compressed.load(testServer(), 'one')).rejects.toMatchObject({
      httpStatus: 413,
      code: 'analysisTooLarge',
    });
  });
  it('times out slow fetches', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), {
            once: true,
          });
        }),
    );
    await expect(store({ fetcher, timeoutMs: 10 }).load(testServer(), 'one')).rejects.toMatchObject(
      { httpStatus: 504, code: 'analysisTimeout' },
    );
  });
  it('limits concurrent analysis work to two sessions', async () => {
    const pending = [deferred<Response>(), deferred<Response>(), deferred<Response>()];
    let started = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => pending[started++].promise);
    const value = store({ fetcher });
    const requests = ['one', 'two', 'three'].map((id) => value.load(testServer(), id));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    pending[0].resolve(response(analysis()));
    await requests[0];
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    pending[1].resolve(response(analysis()));
    pending[2].resolve(response(analysis()));
    await Promise.all(requests);
  });
});
