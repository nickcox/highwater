import {
  experimental_defineHostEntry,
  type ExperimentalHostRpcContext,
} from '@get-bb/plugin-sdk/host';
import { hostContract } from './contract';
import { Analyses, type AnalysisEntry, type AnalysisOptions } from './host/analysis';
import { SessionCatalogue, matchSession } from './host/catalogue';
import { HighwaterProcess, type ProcessOptions } from './host/process';
import { HostFailure, failureResult, matchesEtag, waitFor } from './host/http';

export interface HostOptions {
  process?: Omit<ProcessOptions, 'dataDir'>;
  analysis?: AnalysisOptions;
}
/** Each daemon worker owns one process, catalogue and bounded set of transfers. */
export function createHighwaterEntry(options: HostOptions = {}) {
  let runtime:
    { process: HighwaterProcess; catalogue: SessionCatalogue; analyses: Analyses } | undefined;
  let disposing: Promise<void> | undefined;
  const loading = new Map<string, Promise<AnalysisEntry>>();
  function getRuntime(context: ExperimentalHostRpcContext) {
    if (!runtime) {
      runtime = {
        process: new HighwaterProcess({
          ...options.process,
          dataDir: context.experimental_paths.dataDir,
        }),
        catalogue: new SessionCatalogue(options.analysis?.timeoutMs, options.analysis?.fetcher),
        analyses: new Analyses(options.analysis),
      };
      context.lifecycle.signal.addEventListener(
        'abort',
        () => {
          void dispose().catch(() => {});
        },
        { once: true },
      );
    }
    return runtime;
  }
  function dispose(): Promise<void> {
    disposing ??= (async () => {
      runtime?.analyses.dispose();
      runtime?.catalogue.clear();
      await runtime?.process.dispose();
    })();
    return disposing;
  }
  async function boundary<T>(context: ExperimentalHostRpcContext, work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      if (context.signal.aborted) throw error;
      return failureResult(error);
    }
  }
  async function load(
    input: { binaryPath: string | null; sessionId: string },
    context: ExperimentalHostRpcContext,
  ) {
    const { process, catalogue, analyses } = getRuntime(context);
    const key = JSON.stringify([input.binaryPath?.trim() || null, input.sessionId]);
    let work = loading.get(key);
    if (!work) {
      // Share the entire operation, including lazy startup and catalogue validation. Otherwise
      // serialised startup can let the first analysis finish before the second caller reaches it.
      work = (async () => {
        const server = await process.get(input.binaryPath);
        const sessions = await catalogue.list(server);
        if (!sessions.some((session) => session.id === input.sessionId)) {
          throw new HostFailure(
            404,
            'SESSION_NOT_FOUND',
            'The session is no longer in the Highwater catalogue.',
          );
        }
        return analyses.load(server, input.sessionId);
      })();
      loading.set(key, work);
      void work.finally(() => loading.delete(key)).catch(() => {});
    }
    return waitFor(work, context.signal);
  }
  return experimental_defineHostEntry({
    contract: hostContract,
    handlers: {
      status: (input, context) =>
        getRuntime(context).process.status(input.binaryPath, context.signal),
      findSession: (input, context) =>
        boundary(context, async () => {
          const { process, catalogue } = getRuntime(context);
          const server = await process.get(input.binaryPath, context.signal);
          const entries = await waitFor(catalogue.list(server), context.signal);
          const sessionId = matchSession(entries, input.harness, input.providerThreadId);
          return sessionId ? { found: true as const, sessionId } : { found: false as const };
        }),
      openAnalysis: (input, context) =>
        boundary(context, async () => {
          const entry = await load(input, context);
          return matchesEtag(input.ifNoneMatch, entry.etag)
            ? { status: 'notModified' as const, etag: entry.etag }
            : getRuntime(context).analyses.open(entry);
        }),
      readAnalysisPiece: (input, context) =>
        getRuntime(context).analyses.read(input.transferId, input.index),
      closeAnalysisTransfer: (input, context) =>
        getRuntime(context).analyses.close(input.transferId),
      summary: (input, context) =>
        boundary(context, async () => {
          const entry = await load(input, context);
          return matchesEtag(input.ifNoneMatch, entry.etag)
            ? { status: 'notModified' as const, etag: entry.etag }
            : { status: 'ok' as const, etag: entry.etag, summary: entry.summary };
        }),
    },
    dispose,
  });
}
export default createHighwaterEntry();
