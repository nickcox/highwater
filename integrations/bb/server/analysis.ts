import type { HostErrorResult } from '../contract';
import type { HighwaterHost, ResolvedSession } from './resolve';

const MAX_PIECE_BYTES = 4 * 1024 * 1024;
const MAX_ANALYSIS_BYTES = 64 * 1024 * 1024;
const MAX_PIECES = MAX_ANALYSIS_BYTES / MAX_PIECE_BYTES;
const invalidTransfer = (): HostErrorResult => ({
  status: 'error',
  httpStatus: 502,
  code: 'transferInvalid',
  message: 'Highwater returned an invalid analysis transfer. Retry the request.',
});

/** Retain only one bounded response; always release the host snapshot, including on abort. */
export async function readAnalysis(
  host: HighwaterHost,
  session: ResolvedSession,
  ifNoneMatch: string | null,
  signal: AbortSignal,
  warn: (message: string) => void,
): Promise<
  | { status: 'ok'; etag: string; bytes: Buffer<ArrayBuffer> }
  | { status: 'notModified'; etag: string }
  | HostErrorResult
> {
  const options = { hostId: session.hostId, signal };
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted();
    const opened = await host.call(
      'openAnalysis',
      {
        binaryPath: session.binaryPath,
        sessionId: session.sessionId,
        ifNoneMatch,
      },
      options,
    );
    if (opened.status !== 'ok') return opened;
    try {
      if (opened.pieceCount > MAX_PIECES) return invalidTransfer();
      const pieces: Buffer[] = [];
      let length = 0;
      let expired = false;
      for (let index = 0; index < opened.pieceCount; index++) {
        signal.throwIfAborted();
        const result =
          index === 0
            ? { piece: opened.firstPiece }
            : await host.call(
                'readAnalysisPiece',
                { transferId: opened.transferId, index },
                options,
              );
        if ('expired' in result) {
          expired = true;
          break;
        }
        const piece = Buffer.from(result.piece, 'base64');
        length += piece.length;
        if (
          !piece.length ||
          piece.length > MAX_PIECE_BYTES ||
          length > MAX_ANALYSIS_BYTES ||
          piece.toString('base64') !== result.piece
        )
          return invalidTransfer();
        pieces.push(piece);
      }
      if (!expired)
        return { status: 'ok', etag: opened.etag, bytes: Buffer.concat(pieces, length) };
    } finally {
      // Cleanup must not inherit the cancelled caller's signal. Expiry is the fallback
      // when a worker has exited or this plugin generation can no longer make calls.
      try {
        await host.call(
          'closeAnalysisTransfer',
          { transferId: opened.transferId },
          {
            hostId: session.hostId,
            signal: AbortSignal.timeout(5_000),
            timeoutMs: 5_000,
          },
        );
      } catch {
        warn('Could not close a Highwater transfer; its host expiry will release it.');
      }
    }
  }
  return {
    status: 'error',
    httpStatus: 503,
    code: 'transferExpired',
    message: 'The analysis transfer expired twice. Retry the request.',
  };
}
