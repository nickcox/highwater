import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreadAnalysis } from '../app/thread-analysis';
import { ThreadStateError, fetchThreadAnalysis } from '../app/client';
import { deferred } from './helpers';
import type { AnalysisFetchResult } from '../vendor/highwater-embed';

const cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  await Promise.resolve();
  vi.useRealTimers();
});
function setup(load: (signal: AbortSignal, etag: string | null) => Promise<AnalysisFetchResult>) {
  const thread = new ThreadAnalysis(load);
  cleanups.push(thread.retain());
  return thread;
}
const ok = (etag = '"v1"'): AnalysisFetchResult => ({
  status: 'ok',
  etag,
  analysis: { marker: etag },
});

describe('per-thread analysis store', () => {
  it('shares one fetch and body between two visible views with independent conditional tags', async () => {
    const load = vi.fn(async () => ok());
    const thread = setup(load);
    cleanups.push(
      thread.subscribe(() => {}),
      thread.subscribe(() => {}),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(await thread.read(new AbortController().signal, null, 0)).toEqual(ok());
    expect(await thread.read(new AbortController().signal, '"v1"', 0)).toEqual({
      status: 'notModified',
      etag: '"v1"',
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('keeps a view’s last data and ETag while hidden, and revalidates on resume', async () => {
    const load = vi.fn(async (_signal: AbortSignal, _etag: string | null) => ok());
    const thread = setup(load);
    const stop = thread.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    stop();
    thread.request();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(thread.getSnapshot().analysis?.etag).toBe('"v1"');
    cleanups.push(thread.subscribe(() => {}));
    await vi.advanceTimersByTimeAsync(0);
    expect(load.mock.calls[1][1]).toBe('"v1"');
  });
  it('clears stale data and its ETag after a context clear, but retains data on operational errors', async () => {
    const load = vi.fn(async (_signal: AbortSignal, _etag: string | null) => ok());
    const thread = setup(load);
    cleanups.push(thread.subscribe(() => {}));
    await vi.advanceTimersByTimeAsync(0);
    load.mockRejectedValueOnce(
      new ThreadStateError({ state: 'error', httpStatus: 503, code: 'busy', message: 'busy' }),
    );
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(thread.getSnapshot().analysis).not.toBeNull();
    load.mockRejectedValueOnce(new ThreadStateError({ state: 'noSession' }));
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(thread.getSnapshot().analysis).toBeNull();
    expect(thread.getSnapshot().state).toEqual({ state: 'noSession' });
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(load.mock.calls.at(-1)?.[1]).toBeNull();
  });
  it('ignores late results after the last visible subscriber leaves', async () => {
    const pending = deferred<AnalysisFetchResult>();
    const thread = setup(() => pending.promise);
    const stop = thread.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    stop();
    pending.resolve(ok());
    await vi.advanceTimersByTimeAsync(0);
    expect(thread.getSnapshot().analysis).toBeNull();
  });
  it('routes embedded Retry through the scheduler and cancels an individual waiting view', async () => {
    const load = vi.fn(async () => ok());
    const thread = setup(load);
    cleanups.push(thread.subscribe(() => {}));
    await vi.advanceTimersByTimeAsync(0);
    const controller = new AbortController();
    const waiting = thread.read(controller.signal, '"v1"', 1);
    const rejected = expect(waiting).rejects.toThrow();
    controller.abort();
    await rejected;
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('lets a mounted view wait on the active cycle without queuing another fetch', async () => {
    const pending = deferred<AnalysisFetchResult>();
    const load = vi.fn(() => pending.promise);
    const thread = setup(load);
    cleanups.push(thread.subscribe(() => {}));
    await vi.advanceTimersByTimeAsync(0);
    const waiting = thread.read(new AbortController().signal, null, 0);
    pending.resolve(ok());
    expect(await waiting).toEqual(ok());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('rejects a first-load 304 instead of showing an empty successful view', async () => {
    const thread = setup(async () => ({ status: 'notModified', etag: '"v1"' }));
    cleanups.push(thread.subscribe(() => {}));
    await vi.advanceTimersByTimeAsync(0);
    expect(thread.getSnapshot().state).toMatchObject({ state: 'error' });
    expect(thread.getSnapshot().analysis).toBeNull();
  });
});

describe('analysis HTTP client', () => {
  it('uses only the plugin-scoped thread route, credentials, cancellation and a conditional tag', async () => {
    const signal = new AbortController().signal;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"schemaVersion":1}', { headers: { etag: '"v2"' } }));
    expect(await fetchThreadAnalysis('highwater', 'thr_test1', signal, '"v1"', fetcher)).toEqual({
      status: 'ok',
      analysis: { schemaVersion: 1 },
      etag: '"v2"',
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/plugins/highwater/http/analysis?threadId=thr_test1',
      {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'If-None-Match': '"v1"' },
      },
    );
  });
  it('does not read a body on 304', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 304 }));
    expect(
      await fetchThreadAnalysis('copy', 'thr_test1', new AbortController().signal, '"v1"', fetcher),
    ).toEqual({ status: 'notModified', etag: '"v1"' });
  });
  it.each([
    { state: 'noSession' },
    { state: 'unsupportedAgent', providerId: 'opencode' },
    { state: 'sessionNotFound', providerThreadId: 'native' },
  ])('validates resolution states', async (state) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(state, { status: 409 }));
    await expect(
      fetchThreadAnalysis('highwater', 'thr_test1', new AbortController().signal, null, fetcher),
    ).rejects.toMatchObject({ detail: state });
  });
  it('preserves Highwater errors and handles invalid JSON and invalid state shapes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: 'SESSION_PARSE_FAILED', message: 'source session is invalid' } },
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(new Response('<html>error</html>', { status: 502 }))
      .mockResolvedValueOnce(Response.json({ state: 'unsupportedVersion' }, { status: 409 }));
    const load = () =>
      fetchThreadAnalysis('highwater', 'thr_test1', new AbortController().signal, null, fetcher);
    await expect(load()).rejects.toMatchObject({
      detail: {
        state: 'error',
        httpStatus: 422,
        code: 'SESSION_PARSE_FAILED',
        message: 'source session is invalid',
      },
    });
    await expect(load()).rejects.toMatchObject({ detail: { code: 'invalidResponse' } });
    await expect(load()).rejects.toMatchObject({ detail: { code: 'invalidResponse' } });
  });
});
