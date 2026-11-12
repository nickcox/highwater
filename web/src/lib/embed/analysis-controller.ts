import { readonly, writable } from 'svelte/store';
import { AnalysisValidationError, indexAnalysis } from '../analysis';
import type { AnalysisFetchResult } from '../api/client';
import type { IndexedAnalysis } from '../types';

export interface AnalysisSnapshot {
  indexed: IndexedAnalysis | null;
  loading: boolean;
  error: string;
  revision: number;
  kind: 'selection' | 'replacement' | null;
}

export type AnalysisLoader = (
  signal: AbortSignal,
  etag: string | null,
) => Promise<AnalysisFetchResult>;

/** One embedded session, without catalogue discovery, polling or page navigation. */
export function createAnalysisController(loadAnalysis: AnalysisLoader) {
  let snapshot: AnalysisSnapshot = {
    indexed: null,
    loading: false,
    error: '',
    revision: 0,
    kind: null,
  };
  const store = writable(snapshot);
  let etag: string | null = null;
  let request: AbortController | null = null;
  let disposed = false;
  function update(patch: Partial<AnalysisSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    store.set(snapshot);
  }
  async function refresh(): Promise<void> {
    if (disposed) return;
    request?.abort();
    const current = new AbortController();
    request = current;
    const isCurrent = () => !disposed && request === current && !current.signal.aborted;
    update({ loading: true, error: '' });
    try {
      const result = await loadAnalysis(current.signal, etag);
      if (!isCurrent()) return;
      if (result.status === 'notModified') {
        if (!snapshot.indexed) throw new Error('Not modified without a previous analysis');
        etag = result.etag ?? etag;
      } else {
        const indexed = indexAnalysis(result.analysis);
        if (!isCurrent()) return;
        const kind =
          snapshot.indexed?.analysis.session.id === indexed.analysis.session.id
            ? 'replacement'
            : 'selection';
        etag = result.etag;
        update({ indexed, kind, revision: snapshot.revision + 1 });
      }
    } catch (error) {
      if (!isCurrent()) return;
      update({
        error:
          error instanceof AnalysisValidationError
            ? `Analysis is inconsistent: ${error.message}`
            : error instanceof Error
              ? error.message
              : String(error),
      });
    } finally {
      if (isCurrent()) {
        request = null;
        update({ loading: false });
      }
    }
  }
  function dispose(): void {
    disposed = true;
    request?.abort();
    request = null;
  }
  return { ...readonly(store), refresh, dispose };
}
