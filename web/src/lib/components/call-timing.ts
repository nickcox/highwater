export const TIMING_EXPLANATION =
  'Approximate client-observed elapsed time from Pi response initialization to session recording. Includes waiting, retries and possible extension processing; excludes subsequent tool execution. Effective output rate uses reported output tokens, including reasoning, over the whole interval—not generation-only speed.';

export function responseDuration(ms: number | null): string {
  if (ms === null) return 'Unavailable';
  if (ms < 1000) return `${ms.toLocaleString()} ms`;
  if (ms < 60000) return `${(ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;
  return `${Math.floor(ms / 60000).toLocaleString()} min ${((ms % 60000) / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;
}

export function effectiveOutputRate(rate: number | null): string {
  if (rate === null) return 'Unavailable';
  if (rate > 0 && rate < 0.01) return '<0.01 tok/s';
  return `${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} tok/s`;
}
