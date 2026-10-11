import type { WireSessionAnalysis } from '../types';

export interface SessionListItem {
  id: string;
  fileName: string;
  displayName: string;
  workingDirectory: string | null;
  startedAt: string | null;
  byteSize: number | null;
  modifiedAt: string | null;
  harness?: 'pi' | 'opencode' | 'claude-code';
  parentReference?: string | null;
  /** A Claude Code subagent's type, such as `statusline-setup`. */
  subagentType?: string;
}

export type LiveAvailability = 'active' | 'degraded';

export interface SessionListResult {
  status: 'ok' | 'notModified';
  sessions: SessionListItem[] | null;
  etag: string | null;
  generation: string;
  revision: bigint;
  availability: LiveAvailability;
}

export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const GENERATION_PATTERN = /^[0-9a-f]{32}$/;
const MAX_CATALOG_REVISION = 2n ** 64n - 1n;

function parseListHeaders(response: Response): {
  etag: string | null;
  generation: string;
  revision: bigint;
  availability: LiveAvailability;
} {
  const generation = response.headers.get('X-TokenPlume-Server-Generation');
  if (!generation || !GENERATION_PATTERN.test(generation)) {
    throw new ApiError(
      'Server returned an invalid catalogue generation',
      response.status,
      'INVALID_CATALOG_HEADERS',
    );
  }
  const revisionText = response.headers.get('X-TokenPlume-Catalog-Revision');
  let revision: bigint;
  try {
    if (!revisionText || !/^\d+$/.test(revisionText)) throw new Error('invalid');
    revision = BigInt(revisionText);
  } catch {
    throw new ApiError(
      'Server returned an invalid catalogue revision',
      response.status,
      'INVALID_CATALOG_HEADERS',
    );
  }
  if (revision < 0n || revision > MAX_CATALOG_REVISION) {
    throw new ApiError(
      'Server returned an out-of-range catalogue revision',
      response.status,
      'INVALID_CATALOG_HEADERS',
    );
  }
  const etag = response.headers.get('etag');
  if (!etag) {
    throw new ApiError(
      'Server returned a catalogue response without an ETag',
      response.status,
      'INVALID_CATALOG_HEADERS',
    );
  }
  const availability = response.headers.get('X-TokenPlume-Live-Updates');
  if (availability !== 'active' && availability !== 'degraded') {
    throw new ApiError(
      'Server returned an invalid live-update status',
      response.status,
      'INVALID_CATALOG_HEADERS',
    );
  }
  return {
    etag,
    generation,
    revision,
    availability,
  };
}

async function responseJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (import.meta.env.DEV && typeof performance !== 'undefined')
      performance.mark('tokenplume-response-json-start');
    const value = (await response.json()) as T;
    if (import.meta.env.DEV && typeof performance !== 'undefined') {
      performance.mark('tokenplume-response-json-end');
      performance.measure(
        'tokenplume-response-json-parse',
        'tokenplume-response-json-start',
        'tokenplume-response-json-end',
      );
    }
    return value;
  }
  let message = `${response.status} ${response.statusText}`;
  let code: string | null = null;
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.message) message = body.error.message;
    code = body.error?.code ?? null;
  } catch {
    // Keep the useful HTTP fallback when a proxy returns a non-JSON error page.
  }
  throw new ApiError(message, response.status, code);
}

export async function fetchSessions(
  signal?: AbortSignal,
  etag?: string | null,
): Promise<SessionListResult> {
  const headers = new Headers();
  if (etag) headers.set('If-None-Match', etag);
  const response = await fetch('/api/sessions', { signal, headers });
  if (response.status !== 200 && response.status !== 304) {
    await responseJson<never>(response);
  }
  const metadata = parseListHeaders(response);
  if (response.status === 304) {
    return { ...metadata, status: 'notModified', sessions: null };
  }
  const body = await responseJson<{ sessions: SessionListItem[] }>(response);
  return { ...metadata, status: 'ok', sessions: body.sessions };
}

export type AnalysisFetchResult =
  | { status: 'ok'; analysis: WireSessionAnalysis; etag: string | null }
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
  if (import.meta.env.DEV && typeof performance !== 'undefined')
    performance.mark('tokenplume-fetch-response');
  const responseEtag = response.headers.get('etag');
  if (response.status === 304) return { status: 'notModified', etag: responseEtag };
  return {
    status: 'ok',
    analysis: await responseJson<WireSessionAnalysis>(response),
    etag: responseEtag,
  };
}

export { GENERATION_PATTERN, MAX_CATALOG_REVISION };
