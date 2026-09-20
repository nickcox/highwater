import type { SessionAnalysis } from '../types';

export interface SessionListItem {
  id: string;
  fileName: string;
  displayName: string;
  workingDirectory: string | null;
  startedAt: string | null;
  byteSize: number;
  modifiedAt: string | null;
}

interface ApiErrorBody {
  error?: { message?: string };
}

async function responseJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (import.meta.env.DEV && typeof performance !== 'undefined') performance.mark('tokenplume-response-json-start');
    const value = await response.json() as T;
    if (import.meta.env.DEV && typeof performance !== 'undefined') {
      performance.mark('tokenplume-response-json-end');
      performance.measure('tokenplume-response-json-parse', 'tokenplume-response-json-start', 'tokenplume-response-json-end');
    }
    return value;
  }
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.message) message = body.error.message;
  } catch {
    // Keep the useful HTTP fallback when a proxy returns a non-JSON error page.
  }
  throw new Error(message);
}

export async function fetchSessions(signal?: AbortSignal): Promise<SessionListItem[]> {
  const body = await responseJson<{ sessions: SessionListItem[] }>(
    await fetch('/api/sessions', { signal }),
  );
  return body.sessions;
}

export type AnalysisFetchResult =
  | { status: 'ok'; analysis: SessionAnalysis; etag: string | null }
  | { status: 'notModified'; etag: string | null };

export async function fetchAnalysis(
  id: string,
  signal?: AbortSignal,
  etag?: string | null,
): Promise<AnalysisFetchResult> {
  const headers = new Headers();
  if (etag) headers.set('If-None-Match', etag);
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/analysis`, {
    signal,
    headers,
  });
  if (import.meta.env.DEV && typeof performance !== 'undefined') performance.mark('tokenplume-fetch-response');
  const responseEtag = response.headers.get('etag');
  if (response.status === 304) return { status: 'notModified', etag: responseEtag };
  return {
    status: 'ok',
    analysis: await responseJson<SessionAnalysis>(response),
    etag: responseEtag,
  };
}
