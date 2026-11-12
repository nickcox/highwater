import type { AnalysisFetchResult } from '../vendor/highwater-embed';
import type { ThreadState } from '../state';
import { fetchThreadAnalysis, ThreadStateError } from './client';
import { RefreshScheduler } from './scheduler';

export interface ThreadSnapshot {
  cycle: number;
  revision: number;
  analysis: { analysis: unknown; etag: string | null } | null;
  state: ThreadState | null;
  loading: boolean;
}
type Loader = (signal: AbortSignal, etag: string | null) => Promise<AnalysisFetchResult>;

export class ThreadAnalysis {
  private snapshot: ThreadSnapshot = {
    cycle: 0,
    revision: 0,
    analysis: null,
    state: null,
    loading: false,
  };
  private readonly listeners = new Set<() => void>();
  private readonly observers = new Set<() => void>();
  private readonly scheduler: RefreshScheduler;
  private owners = 0;
  private disposed = false;
  private epoch = 0;
  constructor(
    private readonly load: Loader,
    private readonly release: () => void = () => {},
  ) {
    this.scheduler = new RefreshScheduler(async (signal) => {
      const epoch = this.epoch;
      this.update({ loading: true, cycle: this.snapshot.cycle + 1 });
      try {
        const result = await this.load(signal, this.snapshot.analysis?.etag ?? null);
        if (signal.aborted || epoch !== this.epoch) return {};
        if (result.status === 'notModified' && !this.snapshot.analysis)
          throw new Error(
            'Highwater returned an unchanged result without a previous analysis. Retry the request.',
          );
        this.update({
          revision: this.snapshot.revision + 1,
          analysis:
            result.status === 'ok'
              ? { analysis: result.analysis, etag: result.etag }
              : { ...this.snapshot.analysis!, etag: result.etag ?? this.snapshot.analysis!.etag },
          state: null,
          loading: false,
        });
      } catch (error) {
        if (signal.aborted || epoch !== this.epoch) return {};
        const state: ThreadState =
          error instanceof ThreadStateError
            ? error.detail
            : {
                state: 'error',
                httpStatus: 502,
                code: 'analysisUnavailable',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Could not load Highwater. Check the connection and retry.',
              };
        // A missing/replaced session must never leave another session's charts on screen.
        this.update({
          revision: this.snapshot.revision + 1,
          state,
          loading: false,
          ...(state.state !== 'error' ? { analysis: null } : {}),
        });
      }
      return { sessionNotFound: this.snapshot.state?.state === 'sessionNotFound' };
    });
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
        this.snapshot = { cycle: 0, revision: 0, analysis: null, state: null, loading: false };
        this.release();
      });
    };
  }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.scheduler.start();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.epoch++;
        this.scheduler.stop();
        this.update({ loading: false });
      }
    };
  };
  request = (options: { idle?: boolean; retry?: boolean } = {}): void =>
    this.scheduler.request(options);
  private update(patch: Partial<ThreadSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of [...this.listeners, ...this.observers]) listener();
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
      : { status: 'ok', ...data };
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
    );
    threads.set(key, thread);
  }
  return thread;
}
