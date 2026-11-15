import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreadAnalysis } from '../app/thread-analysis';
import { fetchThreadSummary } from '../app/client';
import type { ThreadSummaryResult } from '../state';
import type { AnalysisFetchResult } from '../vendor/highwater-embed';
import { deferred } from './helpers';

const metrics = {
  callCount: 84,
  compactionCount: 1,
  latestInputTokens: 62400,
  peakInputTokens: 90000,
  series: [10, 20, 5],
  compactionPoints: [],
  recentGrowth: null,
};
const summary = (etag = '"v1"', usedTokens = 62400): ThreadSummaryResult => ({
  state: 'ok',
  etag,
  summary: metrics,
  usage: { usedTokens, contextWindowTokens: 200000 },
});
const analysis = (etag = '"v1"'): AnalysisFetchResult => ({
  status: 'ok',
  etag,
  analysis: { version: etag },
});
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
function setup(
  load = vi.fn(async (_signal: AbortSignal, _etag: string | null) => analysis()),
  loadSummary = vi.fn(
    async (_signal: AbortSignal, _etag: string | null): Promise<ThreadSummaryResult> => summary(),
  ),
) {
  const thread = new ThreadAnalysis(load, () => {}, loadSummary);
  cleanups.push(thread.retain());
  return { thread, load, loadSummary };
}

describe('summary and analysis interests', () => {
  it('fetches only summaries for row-only subscribers, sharing one result between the card and segment', async () => {
    const { thread, load, loadSummary } = setup();
    cleanups.push(
      thread.subscribe(() => {}, 'summary'),
      thread.subscribe(() => {}, 'summary'),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(load).not.toHaveBeenCalled();
    expect(loadSummary).toHaveBeenCalledTimes(1);
    expect(thread.getSnapshot().summary).toEqual(summary());
    expect(thread.getSnapshot().analysis).toBeNull();
    expect(thread.getSnapshot().cycle).toBe(0);
  });
  it('starts row and tab work in one cycle, with independent conditional tags', async () => {
    const { thread, load, loadSummary } = setup();
    cleanups.push(
      thread.subscribe(() => {}),
      thread.subscribe(() => {}, 'summary'),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(load.mock.calls[0][1]).toBeNull();
    expect(loadSummary.mock.calls[0][1]).toBeNull();
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(loadSummary).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1][1]).toBe('"v1"');
    expect(loadSummary.mock.calls[1][1]).toBe('"v1"');
  });
  it('queues tab work when it opens during a row-only cycle', async () => {
    const pending = deferred<ThreadSummaryResult>();
    const { thread, load, loadSummary } = setup();
    loadSummary.mockImplementationOnce(() => pending.promise);
    cleanups.push(thread.subscribe(() => {}, 'summary'));
    await vi.advanceTimersByTimeAsync(0);
    cleanups.push(thread.subscribe(() => {}));
    pending.resolve(summary());
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(loadSummary).toHaveBeenCalledTimes(2);
  });
  it('cancels the tab request when hidden without cancelling a visible row', async () => {
    const a = deferred<AnalysisFetchResult>();
    const s = deferred<ThreadSummaryResult>();
    const { thread, load, loadSummary } = setup();
    load.mockImplementationOnce(() => a.promise);
    loadSummary.mockImplementationOnce(() => s.promise);
    const stopTab = thread.subscribe(() => {});
    cleanups.push(thread.subscribe(() => {}, 'summary'));
    await vi.advanceTimersByTimeAsync(0);
    stopTab();
    expect(load.mock.calls[0][0].aborted).toBe(true);
    expect(loadSummary.mock.calls[0][0].aborted).toBe(false);
    a.resolve(analysis());
    s.resolve(summary());
    await vi.advanceTimersByTimeAsync(0);
    expect(thread.getSnapshot().analysis).toBeNull();
    expect(thread.getSnapshot().summary).toEqual(summary());
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(loadSummary).toHaveBeenCalledTimes(2);
  });
  it('cancels a disappearing row without cancelling the tab', async () => {
    const a = deferred<AnalysisFetchResult>();
    const s = deferred<ThreadSummaryResult>();
    const { thread, load, loadSummary } = setup();
    load.mockImplementationOnce(() => a.promise);
    loadSummary.mockImplementationOnce(() => s.promise);
    cleanups.push(thread.subscribe(() => {}));
    const stopRow = thread.subscribe(() => {}, 'summary');
    await vi.advanceTimersByTimeAsync(0);
    stopRow();
    expect(load.mock.calls[0][0].aborted).toBe(false);
    expect(loadSummary.mock.calls[0][0].aborted).toBe(true);
    a.resolve(analysis());
    s.resolve(summary());
    await vi.advanceTimersByTimeAsync(0);
    expect(thread.getSnapshot().analysis?.etag).toBe('"v1"');
    expect(thread.getSnapshot().summary).toBeNull();
  });
  it('keeps current usage on an unchanged summary, including zero and missing usage', async () => {
    const { thread, loadSummary } = setup();
    cleanups.push(thread.subscribe(() => {}, 'summary'));
    await vi.advanceTimersByTimeAsync(0);
    loadSummary.mockResolvedValueOnce({
      state: 'notModified',
      etag: '"v1"',
      usage: { usedTokens: 0, contextWindowTokens: 200000 },
    });
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(thread.getSnapshot().summary?.usage?.usedTokens).toBe(0);
    loadSummary.mockResolvedValueOnce({ state: 'notModified', etag: '"v1"', usage: null });
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(thread.getSnapshot().summary?.summary).toEqual(metrics);
    expect(thread.getSnapshot().summary?.usage).toBeNull();
  });
  it('clears both representations if one request sees a completed context clear', async () => {
    const { thread, loadSummary } = setup();
    cleanups.push(
      thread.subscribe(() => {}),
      thread.subscribe(() => {}, 'summary'),
    );
    await vi.advanceTimersByTimeAsync(0);
    loadSummary.mockResolvedValueOnce({ state: 'noSession' });
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(thread.getSnapshot()).toMatchObject({
      analysis: null,
      summary: null,
      state: { state: 'noSession' },
      summaryState: { state: 'noSession' },
    });
  });
  it('discards inconsistent ETags and retries one coherent cycle instead of showing mismatched figures', async () => {
    const { thread, load, loadSummary } = setup();
    cleanups.push(
      thread.subscribe(() => {}),
      thread.subscribe(() => {}, 'summary'),
    );
    await vi.advanceTimersByTimeAsync(0);
    load.mockResolvedValueOnce(analysis('"v2"'));
    thread.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(thread.getSnapshot().state).toMatchObject({ state: 'error', code: 'sessionChanged' });
    expect(thread.getSnapshot().analysis?.etag).toBe('"v1"');
    expect(thread.getSnapshot().summary?.etag).toBe('"v1"');
    load.mockResolvedValueOnce(analysis('"v2"'));
    loadSummary.mockResolvedValueOnce(summary('"v2"'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(thread.getSnapshot().analysis?.etag).toBe('"v2"');
    expect(thread.getSnapshot().summary?.etag).toBe('"v2"');
  });
  it('does not auto-poll an analysis failure or display fresh row figures against the tab’s stale version', async () => {
    const { thread, load, loadSummary } = setup();
    cleanups.push(
      thread.subscribe(() => {}),
      thread.subscribe(() => {}, 'summary'),
    );
    await vi.advanceTimersByTimeAsync(0);
    load.mockRejectedValueOnce(new Error('transfer failed'));
    loadSummary.mockResolvedValueOnce(summary('"v2"'));
    thread.request();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(thread.getSnapshot().summaryState).toMatchObject({
      state: 'error',
      message: 'transfer failed',
    });
  });
  it('retries a missing session three times for a summary-only row', async () => {
    const { thread, load, loadSummary } = setup();
    loadSummary.mockResolvedValue({ state: 'sessionNotFound', providerThreadId: 'native' });
    cleanups.push(thread.subscribe(() => {}, 'summary'));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(loadSummary).toHaveBeenCalledTimes(4);
    expect(load).not.toHaveBeenCalled();
  });
  it('rejects an unchanged summary before any summary has been loaded', async () => {
    const { thread, loadSummary } = setup();
    loadSummary.mockResolvedValue({ state: 'notModified', etag: '"v1"', usage: null });
    cleanups.push(thread.subscribe(() => {}, 'summary'));
    await vi.advanceTimersByTimeAsync(0);
    expect(thread.getSnapshot().summaryState).toMatchObject({ state: 'error' });
    expect(thread.getSnapshot().summary).toBeNull();
  });
});

describe('cancellable summary RPC client', () => {
  it('sends only a thread ID and conditional tag through the public RPC route', async () => {
    const signal = new AbortController().signal;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true, result: summary() }));
    expect(await fetchThreadSummary('copy', 'thr_test1', signal, '"old"', fetcher)).toEqual(
      summary(),
    );
    expect(fetcher).toHaveBeenCalledWith('/api/v1/plugins/copy/rpc/threadSummary', {
      method: 'POST',
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'thr_test1', ifNoneMatch: '"old"' }),
    });
  });
  it('validates states, unchanged usage and bounded series at the wire boundary', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, result: { state: 'noSession' } }))
      .mockResolvedValueOnce(
        Response.json({ ok: true, result: { state: 'notModified', etag: '"v1"', usage: null } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          result: { ...summary(), summary: { ...metrics, series: Array(61).fill(1) } },
        }),
      );
    const load = () =>
      fetchThreadSummary('highwater', 'thr_test1', new AbortController().signal, null, fetcher);
    expect(await load()).toEqual({ state: 'noSession' });
    expect(await load()).toMatchObject({ state: 'notModified', usage: null });
    await expect(load()).rejects.toMatchObject({ detail: { code: 'invalidResponse' } });
  });
  it('preserves RPC refusals and rejects unreadable responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { ok: false, error: { code: 'forbidden', message: 'Access refused' } },
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(new Response('not JSON', { status: 502 }));
    const load = () =>
      fetchThreadSummary('highwater', 'thr_test1', new AbortController().signal, null, fetcher);
    await expect(load()).rejects.toMatchObject({ detail: { code: 'forbidden', httpStatus: 403 } });
    await expect(load()).rejects.toMatchObject({ detail: { code: 'invalidResponse' } });
  });
});
