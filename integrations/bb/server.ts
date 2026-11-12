import type { BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';
import { hostContract, rpcContract, threadRequestSchema, type ThreadState } from './contract';
import { readAnalysis } from './server/analysis';
import { hostErrorState, resolveThread } from './server/resolve';

export { rpcContract } from './contract';
const responseHeaders = { 'cache-control': 'private, no-store', vary: 'If-None-Match' };

export default function highwaterPlugin(bb: BbPluginApi): void {
  const settings = bb.settings.define({
    binaryPath: {
      type: 'string',
      default: '',
      label: 'Highwater binary',
      experimental_schema: z.string().max(4096),
    },
  });
  const host = bb.hosts.experimental_client({ contract: hostContract });
  const lifecycle = new AbortController();
  bb.onDispose(() => lifecycle.abort());
  const resolve = async (threadId: string, signal: AbortSignal) => {
    const { binaryPath } = await settings.get();
    return resolveThread(bb.sdk, host, threadId, binaryPath.trim() || null, signal);
  };
  function failure(error: unknown): ThreadState & { state: 'error' } {
    bb.log.warn(
      `Highwater request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      state: 'error',
      httpStatus: 502,
      code: 'bbUnavailable',
      message: 'bb could not load this thread’s Highwater analysis. Retry the request.',
    };
  }
  const jsonState = (state: ThreadState) =>
    Response.json(
      state.state === 'error' ? { error: { code: state.code, message: state.message } } : state,
      { status: state.state === 'error' ? state.httpStatus : 409, headers: responseHeaders },
    );

  bb.http.route(
    'GET',
    '/analysis',
    async (context) => {
      const url = new URL(context.req.url);
      const parsed = threadRequestSchema.safeParse({
        threadId: url.searchParams.get('threadId'),
        ifNoneMatch: context.req.header('if-none-match') ?? null,
      });
      if (!parsed.success || url.searchParams.size !== 1)
        return Response.json(
          {
            error: {
              code: 'invalidRequest',
              message: 'Supply one valid threadId and, optionally, an If-None-Match header.',
            },
          },
          { status: 400, headers: responseHeaders },
        );
      const signal = AbortSignal.any([context.req.raw.signal, lifecycle.signal]);
      try {
        const session = await resolve(parsed.data.threadId, signal);
        if (session.state !== 'resolved') return jsonState(session);
        const result = await readAnalysis(
          host,
          session,
          parsed.data.ifNoneMatch,
          signal,
          (message) => {
            if (!lifecycle.signal.aborted) bb.log.warn(message);
          },
        );
        signal.throwIfAborted();
        if (result.status === 'error') return jsonState(hostErrorState(result));
        const headers = { ...responseHeaders, etag: result.etag };
        if (result.status === 'notModified') return new Response(null, { status: 304, headers });
        return new Response(result.bytes, {
          headers: { ...headers, 'content-type': 'application/json', 'content-encoding': 'gzip' },
        });
      } catch (error) {
        if (signal.aborted) return new Response(null, { status: 499, headers: responseHeaders });
        return jsonState(failure(error));
      }
    },
    { auth: 'local' },
  );

  bb.rpc.register(rpcContract, {
    async threadSummary({ threadId, ifNoneMatch }, context) {
      const signal = AbortSignal.any([context.experimental_signal, lifecycle.signal]);
      try {
        const session = await resolve(threadId, signal);
        if (session.state !== 'resolved') return session;
        const result = await host.call(
          'summary',
          { binaryPath: session.binaryPath, sessionId: session.sessionId, ifNoneMatch },
          { hostId: session.hostId, signal },
        );
        if (result.status === 'error') return hostErrorState(result);
        const { usage } = await bb.sdk.threads.context({ threadId, signal });
        const currentUsage = usage
          ? { usedTokens: usage.usedTokens, contextWindowTokens: usage.modelContextWindow }
          : null;
        return result.status === 'notModified'
          ? { state: 'notModified' as const, etag: result.etag, usage: currentUsage }
          : {
              state: 'ok' as const,
              etag: result.etag,
              summary: result.summary,
              usage: currentUsage,
            };
      } catch (error) {
        if (signal.aborted)
          return {
            state: 'error' as const,
            httpStatus: 499,
            code: 'requestCancelled',
            message: 'The request was cancelled.',
          };
        return failure(error);
      }
    },
  });
  bb.events.on('experimental_thread.events', ({ thread }) => {
    bb.realtime.publish('thread-advanced', { threadId: thread.id, idle: false });
  });
  bb.events.on('thread.idle', ({ thread }) => {
    bb.realtime.publish('thread-advanced', { threadId: thread.id, idle: true });
  });
  bb.events.on('thread.failed', ({ thread }) => {
    bb.realtime.publish('thread-advanced', { threadId: thread.id, idle: true });
  });
}
