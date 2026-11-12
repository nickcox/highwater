import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { createAnalysisController } from './analysis-controller';
import type { AnalysisFetchResult } from '../api/client';
import { testAnalysis } from '../context-river/test-data';
import { toWireAnalysis } from '../testing/wire-analysis';

function result(id = 'one', etag = 'v1'): AnalysisFetchResult {
  const analysis = testAnalysis();
  analysis.session.id = id;
  return { status: 'ok', etag, analysis: toWireAnalysis(analysis) };
}
function deferred() {
  let resolve!: (value: AnalysisFetchResult) => void;
  const promise = new Promise<AnalysisFetchResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('embedded analysis controller', () => {
  it('loads, validates and indexes the first selection', async () => {
    const load = vi.fn(async () => result());
    const controller = createAnalysisController(load);
    await controller.refresh();
    expect(get(controller)).toMatchObject({
      loading: false,
      error: '',
      kind: 'selection',
      revision: 1,
    });
    expect(get(controller).indexed?.analysis.session.id).toBe('one');
    expect(load.mock.calls[0]).toEqual([expect.any(AbortSignal), null]);
    controller.dispose();
  });

  it('revalidates with the ETag without replacing an unchanged index', async () => {
    const load = vi
      .fn<() => Promise<AnalysisFetchResult>>()
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce({ status: 'notModified', etag: 'v1' });
    const controller = createAnalysisController(load);
    await controller.refresh();
    const indexed = get(controller).indexed;
    await controller.refresh();
    expect(get(controller).indexed).toBe(indexed);
    expect(get(controller).revision).toBe(1);
    expect(load.mock.calls[1]).toEqual([expect.any(AbortSignal), 'v1']);
    controller.dispose();
  });

  it('distinguishes replacements from a different session', async () => {
    const load = vi
      .fn<() => Promise<AnalysisFetchResult>>()
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result('one', 'v2'))
      .mockResolvedValueOnce(result('two', 'v3'));
    const controller = createAnalysisController(load);
    await controller.refresh();
    await controller.refresh();
    expect(get(controller).kind).toBe('replacement');
    await controller.refresh();
    expect(get(controller).kind).toBe('selection');
    expect(get(controller).revision).toBe(3);
    controller.dispose();
  });

  it('keeps the previous analysis after validation failure and can retry', async () => {
    const invalid = result();
    if (invalid.status === 'ok') invalid.analysis.schemaVersion = 999;
    const load = vi
      .fn<() => Promise<AnalysisFetchResult>>()
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(result('one', 'v2'));
    const controller = createAnalysisController(load);
    await controller.refresh();
    const indexed = get(controller).indexed;
    await controller.refresh();
    expect(get(controller).indexed).toBe(indexed);
    expect(get(controller).error).toContain('Unsupported analysis schema');
    await controller.refresh();
    expect(get(controller).error).toBe('');
    expect(get(controller).kind).toBe('replacement');
    controller.dispose();
  });

  it('cancels superseded requests and ignores late results even if the loader ignores abort', async () => {
    const first = deferred();
    const load = vi
      .fn<(signal: AbortSignal) => Promise<AnalysisFetchResult>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(result('two'));
    const controller = createAnalysisController(load);
    const pending = controller.refresh();
    await controller.refresh();
    expect(load.mock.calls[0][0].aborted).toBe(true);
    first.resolve(result('one'));
    await pending;
    expect(get(controller).indexed?.analysis.session.id).toBe('two');
    expect(get(controller).revision).toBe(1);
    controller.dispose();
  });

  it('aborts on dispose and ignores later refreshes', async () => {
    const pending = deferred();
    const load = vi.fn<(signal: AbortSignal) => Promise<AnalysisFetchResult>>(
      () => pending.promise,
    );
    const controller = createAnalysisController(load);
    const refresh = controller.refresh();
    controller.dispose();
    expect(load.mock.calls[0][0].aborted).toBe(true);
    pending.resolve(result());
    await refresh;
    await controller.refresh();
    expect(get(controller).indexed).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports an initial error or an invalid initial 304', async () => {
    const load = vi
      .fn<() => Promise<AnalysisFetchResult>>()
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({ status: 'notModified', etag: 'v1' });
    const controller = createAnalysisController(load);
    await controller.refresh();
    expect(get(controller).error).toBe('Unavailable');
    await controller.refresh();
    expect(get(controller).error).toContain('without a previous analysis');
    controller.dispose();
  });
});
