import type { AnalysisFetchResult } from '../vendor/highwater-embed';
import type { ThreadState, ThreadSummaryData, ThreadSummaryResult } from '../state';
import {
  fetchThreadAnalysis,
  fetchThreadSummary,
  ThreadStateError,
  type ThreadAnalysisResult,
} from './client';
import { RefreshScheduler } from './scheduler';

export type Interest = 'analysis' | 'summary';
export interface ThreadSnapshot {
  cycle: number;
  revision: number;
  analysis: { analysis: unknown; etag: string | null; version: string | null } | null;
  state: ThreadState | null;
  loading: boolean;
  summary: ThreadSummaryData | null;
  summaryState: ThreadState | null;
  summaryLoading: boolean;
}
type Loader<T> = (signal: AbortSignal, etag: string | null) => Promise<T>;
type Outcome<T> = { result: T } | { state: ThreadState };
const initialSnapshot = (): ThreadSnapshot => ({
  cycle: 0,
  revision: 0,
  analysis: null,
  state: null,
  loading: false,
  summary: null,
  summaryState: null,
  summaryLoading: false,
});
function errorState(error: unknown): ThreadState {
  return error instanceof ThreadStateError
    ? error.detail
    : {
        state: 'error',
        httpStatus: 502,
        code: 'contextUnavailable',
        message:
          error instanceof Error
            ? error.message
            : 'Could not load Highwater. Check the connection and retry.',
      };
}

export class ThreadAnalysis {
  private snapshot = initialSnapshot();
  private readonly listeners = new Map<() => void, Interest>();
  private readonly observers = new Set<() => void>();
  private readonly scheduler: RefreshScheduler;
  private readonly requests: Partial<Record<Interest, AbortController>> = {};
  private readonly epochs = { analysis: 0, summary: 0 };
  private owners = 0;
  private disposed = false;
  private epoch = 0;
  constructor(
    private readonly load: Loader<ThreadAnalysisResult>,
    private readonly release: () => void = () => {},
    private readonly loadSummary?: Loader<ThreadSummaryResult>,
  ) {
    this.scheduler = new RefreshScheduler(async (signal) => {
      const epoch = this.epoch;
      const analysis = this.count('analysis') > 0;
      const summary = this.count('summary') > 0;
      this.update({
        loading: analysis,
        summaryLoading: summary,
        ...(analysis ? { cycle: this.snapshot.cycle + 1 } : {}),
      });
      // Start both together so the host can share its catalogue and analysis work.
      const [a, s] = await Promise.all([
        analysis
          ? this.fetchPart('analysis', signal, this.load, this.snapshot.analysis?.etag ?? null)
          : undefined,
        summary
          ? this.fetchPart(
              'summary',
              signal,
              this.loadSummary ??
                (() => Promise.reject(new Error('Summary loader is unavailable.'))),
              this.snapshot.summary?.etag ?? null,
            )
          : undefined,
      ]);
      if (signal.aborted || epoch !== this.epoch) return {};
      const patch: Partial<ThreadSnapshot> = {};
      const resolution = [a, s].find(
        (outcome) => outcome && 'state' in outcome && outcome.state.state !== 'error',
      );
      if (resolution && 'state' in resolution) {
        // A completed clear or missing identity invalidates both representations.
        Object.assign(patch, {
          analysis: null,
          summary: null,
          state: resolution.state,
          summaryState: resolution.state,
          revision: this.snapshot.revision + 1,
        });
      } else {
        if (a) {
          patch.revision = this.snapshot.revision + 1;
          if ('state' in a) patch.state = a.state;
          else if (a.result.status === 'ok') {
            patch.analysis = {
              analysis: a.result.analysis,
              etag: a.result.etag,
              version: a.result.version ?? null,
            };
            patch.state = null;
          } else if (this.snapshot.analysis) {
            patch.analysis = {
              ...this.snapshot.analysis,
              etag: a.result.etag ?? this.snapshot.analysis.etag,
              version: a.result.version ?? this.snapshot.analysis.version,
            };
            patch.state = null;
          } else
            patch.state = errorState(
              new Error(
                'Highwater returned an unchanged result without a previous analysis. Retry the request.',
              ),
            );
        }
        if (s) {
          if ('state' in s) patch.summaryState = s.state;
          else if (s.result.state === 'ok') {
            patch.summary = s.result;
            patch.summaryState = null;
          } else if (s.result.state === 'notModified' && this.snapshot.summary) {
            patch.summary = {
              ...this.snapshot.summary,
              etag: s.result.etag,
              usage: s.result.usage,
            };
            patch.summaryState = null;
          } else
            patch.summaryState = errorState(
              new Error(
                'Highwater returned an unchanged summary without a previous summary. Retry the request.',
              ),
            );
        }
        const nextAnalysis = patch.analysis ?? this.snapshot.analysis;
        const nextSummary = patch.summary ?? this.snapshot.summary;
        if (a && s && nextAnalysis && nextSummary && nextAnalysis.etag !== nextSummary.etag) {
          if ('result' in a && 'result' in s) {
            const changed: ThreadState = {
              state: 'error',
              httpStatus: 409,
              code: 'sessionChanged',
              message: 'The session changed while updating. Refreshing again.',
            };
            // Do not publish figures from two different analysis versions as one update.
            patch.analysis = this.snapshot.analysis;
            patch.summary = this.snapshot.summary;
            patch.state = patch.summaryState = changed;
            this.scheduler.request();
          } else if ('state' in a) {
            // The tab labels its old analysis as stale; do not pair it with fresh row figures.
            patch.summaryState = a.state;
          }
        }
      }
      this.update({ ...patch, loading: false, summaryLoading: false });
      return {
        sessionNotFound:
          this.snapshot.state?.state === 'sessionNotFound' ||
          this.snapshot.summaryState?.state === 'sessionNotFound',
      };
    });
  }
  private count(interest: Interest): number {
    return [...this.listeners.values()].filter((value) => value === interest).length;
  }
  private async fetchPart<T extends ThreadAnalysisResult | ThreadSummaryResult>(
    interest: Interest,
    batch: AbortSignal,
    load: Loader<T>,
    etag: string | null,
  ): Promise<Outcome<T> | undefined> {
    const request = new AbortController();
    const epoch = this.epochs[interest];
    const signal = AbortSignal.any([batch, request.signal]);
    this.requests[interest] = request;
    try {
      const result = await load(signal, etag);
      if (signal.aborted || epoch !== this.epochs[interest]) return;
      if ('state' in result && result.state !== 'ok' && result.state !== 'notModified')
        return { state: result };
      return { result };
    } catch (error) {
      if (!signal.aborted && epoch === this.epochs[interest]) return { state: errorState(error) };
    } finally {
      if (this.requests[interest] === request) delete this.requests[interest];
    }
  }
  getSnapshot = (): ThreadSnapshot => this.snapshot;
  retain(): () => void {
    this.owners++;
    return () => {
      this.owners--;
      // React's development cleanup/setup pair must reuse the same live entry.
      queueMicrotask(() => {
        if (this.owners || this.listeners.size || this.disposed) return;
        this.disposed = true;
        this.epoch++;
        this.scheduler.stop();
        this.snapshot = initialSnapshot();
        this.release();
      });
    };
  }
  subscribe = (listener: () => void, interest: Interest = 'analysis'): (() => void) => {
    const firstInterest = this.count(interest) === 0;
    this.listeners.set(listener, interest);
    if (this.listeners.size === 1) this.scheduler.start();
    else if (firstInterest) this.scheduler.request();
    return () => {
      this.listeners.delete(listener);
      if (!this.count(interest)) {
        this.epochs[interest]++;
        this.requests[interest]?.abort();
        this.update(interest === 'analysis' ? { loading: false } : { summaryLoading: false });
      }
      if (!this.listeners.size) {
        this.epoch++;
        this.scheduler.stop();
      }
    };
  };
  request = (options: { idle?: boolean; retry?: boolean } = {}): void =>
    this.scheduler.request(options);
  private update(patch: Partial<ThreadSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of [...this.listeners.keys(), ...this.observers]) listener();
  }
  /** The view consumes the shared response; its Retry requests work through the scheduler too. */
  async read(
    signal: AbortSignal,
    etag: string | null,
    deliveredRevision: number,
  ): Promise<AnalysisFetchResult> {
    signal.throwIfAborted();
    if (this.snapshot.loading || this.snapshot.revision <= deliveredRevision) {
      const revision = this.snapshot.revision;
      await new Promise<void>((resolve, reject) => {
        const changed = () => {
          if (this.snapshot.revision > revision) {
            cleanup();
            resolve();
          }
        };
        const abort = () => {
          cleanup();
          reject(signal.reason);
        };
        const cleanup = () => {
          this.observers.delete(changed);
          signal.removeEventListener('abort', abort);
        };
        this.observers.add(changed);
        signal.addEventListener('abort', abort, { once: true });
        if (!this.snapshot.loading) this.request({ retry: true });
      });
    }
    signal.throwIfAborted();
    if (this.snapshot.state) throw new ThreadStateError(this.snapshot.state);
    const data = this.snapshot.analysis;
    if (!data) throw new Error('No current Highwater analysis.');
    return etag !== null && etag === data.etag
      ? { status: 'notModified', etag: data.etag }
      : { status: 'ok', analysis: data.analysis, etag: data.etag };
  }
}

// This module belongs to one plugin generation in one bb window, not the bb server.
const threads = new Map<string, ThreadAnalysis>();
export function getThreadAnalysis(pluginId: string, threadId: string): ThreadAnalysis {
  const key = `${pluginId}:${threadId}`;
  let thread = threads.get(key);
  if (!thread) {
    thread = new ThreadAnalysis(
      (signal, etag) => fetchThreadAnalysis(pluginId, threadId, signal, etag),
      () => threads.delete(key),
      (signal, etag) => fetchThreadSummary(pluginId, threadId, signal, etag),
    );
    threads.set(key, thread);
  }
  return thread;
}
