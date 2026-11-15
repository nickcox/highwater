import { z } from 'zod';
import {
  threadIdSchema,
  threadStateSchema,
  threadRequestSchema,
  threadSummaryResultSchema,
  type ThreadState,
  type ThreadSummaryResult,
} from '../state';

export class ThreadStateError extends Error {
  constructor(readonly detail: ThreadState) {
    super(
      detail.state === 'error' || detail.state === 'startFailed' ? detail.message : detail.state,
    );
  }
}
/** The analysis with the Highwater version that produced it, when bb reported one. */
export type ThreadAnalysisResult =
  | { status: 'ok'; analysis: unknown; etag: string | null; version?: string | null }
  | { status: 'notModified'; etag: string | null; version?: string | null };
const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const summaryEnvelope = z.object({ ok: z.literal(true), result: threadSummaryResultSchema });
const failure = (httpStatus: number, code: string, message: string) =>
  new ThreadStateError({ state: 'error', httpStatus, code, message });

/** The public RPC wire route is used because useRpc in SDK 0.6.132 has no AbortSignal. */
export async function fetchThreadSummary(
  pluginId: string,
  threadId: string,
  signal: AbortSignal,
  etag: string | null,
  fetcher: typeof fetch = fetch,
): Promise<ThreadSummaryResult> {
  const input = threadRequestSchema.parse({ threadId, ifNoneMatch: etag });
  const response = await fetcher(
    `/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/threadSummary`,
    {
      method: 'POST',
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw failure(
      502,
      'invalidResponse',
      'bb returned an unreadable Highwater summary. Retry the request.',
    );
  }
  const parsed = summaryEnvelope.safeParse(body);
  if (response.status === 200 && parsed.success) return parsed.data.result;
  const error = errorBody.safeParse(body);
  if (error.success)
    throw failure(
      response.status >= 400 ? response.status : 502,
      error.data.error.code,
      error.data.error.message,
    );
  throw failure(
    502,
    'invalidResponse',
    'bb returned an invalid Highwater summary. Retry the request.',
  );
}

export async function fetchThreadAnalysis(
  pluginId: string,
  threadId: string,
  signal: AbortSignal,
  etag: string | null,
  fetcher: typeof fetch = fetch,
): Promise<ThreadAnalysisResult> {
  threadIdSchema.parse(threadId);
  const response = await fetcher(
    `/api/v1/plugins/${encodeURIComponent(pluginId)}/http/analysis?threadId=${encodeURIComponent(threadId)}`,
    {
      signal,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: etag ? { 'If-None-Match': etag } : {},
    },
  );
  const nextEtag = response.headers.get('etag');
  const version = response.headers.get('x-highwater-version');
  if (response.status === 304) return { status: 'notModified', etag: nextEtag ?? etag, version };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw failure(
      502,
      'invalidResponse',
      'bb returned an unreadable Highwater response. Retry the request.',
    );
  }
  if (response.status === 200) return { status: 'ok', analysis: body, etag: nextEtag, version };
  if (response.status === 409) {
    const state = threadStateSchema.safeParse(body);
    if (state.success) throw new ThreadStateError(state.data);
  }
  const error = errorBody.safeParse(body);
  if (error.success)
    throw failure(response.status, error.data.error.code, error.data.error.message);
  throw failure(
    response.status >= 400 ? response.status : 502,
    'invalidResponse',
    'bb could not load this Highwater analysis. Retry the request.',
  );
}
