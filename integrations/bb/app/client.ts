import { z } from 'zod';
import { threadIdSchema, threadStateSchema, type ThreadState } from '../state';
import type { AnalysisFetchResult } from '../vendor/highwater-embed';

export class ThreadStateError extends Error {
  constructor(readonly detail: ThreadState) {
    super(
      detail.state === 'error' || detail.state === 'startFailed' ? detail.message : detail.state,
    );
  }
}
const errorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const failure = (httpStatus: number, code: string, message: string) =>
  new ThreadStateError({ state: 'error', httpStatus, code, message });

export async function fetchThreadAnalysis(
  pluginId: string,
  threadId: string,
  signal: AbortSignal,
  etag: string | null,
  fetcher: typeof fetch = fetch,
): Promise<AnalysisFetchResult> {
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
  if (response.status === 304) return { status: 'notModified', etag: nextEtag ?? etag };
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
  if (response.status === 200) return { status: 'ok', analysis: body, etag: nextEtag };
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
