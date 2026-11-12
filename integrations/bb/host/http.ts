export interface HighwaterServer {
  baseUrl: string;
  generation: number;
  signal: AbortSignal;
  version: string;
  pid: number;
}

export class HostFailure extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HostFailure';
  }
}
export function failureResult(error: unknown) {
  const failure =
    error instanceof HostFailure
      ? error
      : new HostFailure(
          502,
          'highwaterFailed',
          error instanceof Error ? error.message : String(error),
        );
  return {
    status: 'error' as const,
    httpStatus: failure.httpStatus,
    code: failure.code,
    message: failure.message,
  };
}

/** A caller can stop waiting without cancelling work shared with other callers. */
export function waitFor<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function readBody(response: Response, limit: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const tooLarge = () =>
    new HostFailure(413, 'analysisTooLarge', `Highwater response exceeds the ${limit}-byte limit.`);
  if (Number(response.headers.get('content-length') ?? 0) > limit) {
    await response.body.cancel();
    throw tooLarge();
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(Buffer.from(result.value));
    }
    return Buffer.concat(chunks, length);
  } finally {
    reader.releaseLock();
  }
}

export async function highwaterError(response: Response): Promise<never> {
  let code = 'highwaterFailed';
  let message = `Highwater returned HTTP ${response.status}.`;
  const body = await readBody(response, 32 * 1024);
  try {
    const parsed = JSON.parse(body.toString('utf8'));
    if (typeof parsed?.error?.code === 'string') code = parsed.error.code;
    if (typeof parsed?.error?.message === 'string') message = parsed.error.message;
  } catch {
    /* Keep the HTTP status when the response is not an API error. */
  }
  throw new HostFailure(response.status >= 400 ? response.status : 502, code, message);
}

export async function request<T>(
  server: HighwaterServer,
  path: string,
  etag: string | null,
  timeoutMs: number,
  action: (response: Response, signal: AbortSignal) => Promise<T>,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = AbortSignal.any([timeout, server.signal]);
  try {
    const response = await fetcher(server.baseUrl + path, {
      headers: etag ? { 'If-None-Match': etag } : {},
      signal,
      redirect: 'error',
    });
    signal.throwIfAborted();
    const result = await action(response, signal);
    signal.throwIfAborted();
    return result;
  } catch (error) {
    if (server.signal.aborted)
      throw new HostFailure(503, 'processStopped', 'Highwater stopped; retry the request.');
    if (timeout.aborted)
      throw new HostFailure(
        504,
        'analysisTimeout',
        'Highwater did not respond before the request timed out.',
      );
    throw error;
  }
}

export function matchesEtag(candidate: string | null, etag: string): boolean {
  return candidate?.split(',').some((value) => value.trim() === etag) ?? false;
}
