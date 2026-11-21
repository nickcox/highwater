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
  process?: Omit<ProcessOptions, 'dataDir' | 'legacyPi'>;
  analysis?: AnalysisOptions;
}
interface SourceRuntime {
  process: HighwaterProcess;
  catalogue: SessionCatalogue;
}

/** Each worker owns the main server and may start a second one for legacy Pi sessions. */
export function createHighwaterEntry(options: HostOptions = {}) {
  let runtime: { primary: SourceRuntime; legacyPi?: SourceRuntime; analyses: Analyses } | undefined;
  let disposing: Promise<void> | undefined;
  const loading = new Map<string, Promise<AnalysisEntry>>();
  function createSource(context: ExperimentalHostRpcContext, legacyPi = false): SourceRuntime {
    return {
      process: new HighwaterProcess({
        ...options.process,
        legacyPi,
        dataDir: context.experimental_paths.dataDir,
      }),
      catalogue: new SessionCatalogue(options.analysis?.timeoutMs, options.analysis?.fetcher),
    };
  }
  function getRuntime(context: ExperimentalHostRpcContext) {
    if (!runtime) {
      runtime = {
        primary: createSource(context),
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
  function getSource(context: ExperimentalHostRpcContext, legacyPi = false): SourceRuntime {
    const worker = getRuntime(context);
    return legacyPi ? (worker.legacyPi ??= createSource(context, true)) : worker.primary;
  }
  function dispose(): Promise<void> {
    disposing ??= (async () => {
      runtime?.analyses.dispose();
      runtime?.primary.catalogue.clear();
      runtime?.legacyPi?.catalogue.clear();
      await Promise.all([runtime?.primary.process.dispose(), runtime?.legacyPi?.process.dispose()]);
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
    input: { binaryPath: string | null; sessionId: string; legacyPi?: true },
    context: ExperimentalHostRpcContext,
  ) {
    const { process, catalogue } = getSource(context, input.legacyPi);
    const { analyses } = getRuntime(context);
    const key = JSON.stringify([
      input.binaryPath?.trim() || null,
      input.sessionId,
      !!input.legacyPi,
    ]);
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
        return analyses.load(server, input.sessionId, input.legacyPi);
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
        getSource(context).process.status(input.binaryPath, context.signal),
      findSession: (input, context) =>
        boundary(context, async () => {
          const find = async ({ process, catalogue }: SourceRuntime) => {
            const server = await process.get(input.binaryPath, context.signal);
            const entries = await waitFor(catalogue.list(server), context.signal);
            return matchSession(entries, input.harness, input.providerThreadId);
          };
          const primary = getSource(context);
          const sessionId = await find(primary);
          if (sessionId) return { found: true as const, sessionId };
          if (input.harness === 'pi' && (await primary.process.hasLegacyPiFallback())) {
            const legacySessionId = await find(getSource(context, true));
            if (legacySessionId)
              return { found: true as const, sessionId: legacySessionId, legacyPi: true as const };
          }
          return { found: false as const };
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
