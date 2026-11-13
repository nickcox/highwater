import type { BbPluginApi, ExperimentalHostClient } from '@get-bb/plugin-sdk';
import { hostContract, type HostErrorResult, type ThreadState } from '../contract';

export type HighwaterHost = ExperimentalHostClient<typeof hostContract>;
export interface ResolvedSession {
  state: 'resolved';
  hostId: string;
  harness: 'pi' | 'claude-code' | 'codex';
  providerThreadId: string;
  sessionId: string;
  binaryPath: string | null;
}
export function hostErrorState(error: HostErrorResult): ThreadState {
  return { state: 'error', httpStatus: error.httpStatus, code: error.code, message: error.message };
}
function notFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/** Resolve again on every request: edits and completed clears can replace the identity. */
export async function resolveThread(
  sdk: BbPluginApi['sdk'],
  host: HighwaterHost,
  threadId: string,
  binaryPath: string | null,
  signal: AbortSignal,
): Promise<ResolvedSession | ThreadState> {
  signal.throwIfAborted();
  const thread = await sdk.threads.get({ threadId, signal }).catch((error: unknown) => {
    if (notFound(error)) return null;
    throw error;
  });
  if (!thread) return { state: 'unknownThread' };
  const harness = thread.providerId;
  if (harness !== 'pi' && harness !== 'claude-code' && harness !== 'codex')
    return { state: 'unsupportedAgent', providerId: harness };
  if (!thread.environmentId) return { state: 'noEnvironment' };

  let providerThreadId: string | undefined;
  let beforeSeq: string | undefined;
  while (!providerThreadId) {
    signal.throwIfAborted();
    const events = await sdk.threads.events.list({
      threadId,
      signal,
      order: 'desc',
      limit: '100',
      types: ['thread/identity', 'system/operation'],
      ...(beforeSeq === undefined ? {} : { beforeSeq }),
    });
    if (!events.length) return { state: 'noSession' };
    for (const event of events) {
      if (
        event.type === 'system/operation' &&
        event.data.operation === 'context_clear' &&
        event.data.status === 'completed'
      )
        return { state: 'noSession' };
      if (event.type === 'thread/identity') {
        // Do not fall back to an older identity when the newest one is unusable.
        if (!event.data.providerThreadId || event.data.providerThreadId.length > 256)
          return { state: 'noSession' };
        providerThreadId = event.data.providerThreadId;
        break;
      }
    }
    const next = events[events.length - 1].seq;
    if (
      !Number.isSafeInteger(next) ||
      next < 0 ||
      (beforeSeq !== undefined && next >= Number(beforeSeq))
    )
      throw new Error('bb returned a non-advancing thread event page.');
    beforeSeq = String(next);
  }
  const environment = await sdk.environments
    .get({ environmentId: thread.environmentId, signal })
    .catch((error: unknown) => {
      if (notFound(error)) return null;
      throw error;
    });
  if (!environment?.hostId) return { state: 'noEnvironment' };
  const options = { hostId: environment.hostId, signal };
  const status = await host.call('status', { binaryPath }, { ...options, timeoutMs: 60_000 });
  switch (status.state) {
    case 'missing':
      return { state: 'binaryMissing' };
    case 'unsupportedVersion':
      return { state: 'unsupportedVersion', version: status.version, accepted: status.accepted };
    case 'failed':
      return { state: 'startFailed', message: status.message };
  }
  const found = await host.call('findSession', { binaryPath, harness, providerThreadId }, options);
  if ('status' in found) return hostErrorState(found);
  if (!found.found) return { state: 'sessionNotFound', providerThreadId };
  return {
    state: 'resolved',
    hostId: environment.hostId,
    harness,
    providerThreadId,
    sessionId: found.sessionId,
    binaryPath,
  };
}
