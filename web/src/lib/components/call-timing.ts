const RATE = 'The rate is reported output, including reasoning, over that time.';

/** What a call's response time measures, for the source that recorded it. */
export function timingExplanation(source: string, traced = false): string {
  switch (source) {
    case 'claude-code':
      return 'Claude Code does not record when a request started, so the response time and output rate are unavailable.';
    case 'vscode-copilot':
      return traced
        ? `From Copilot sending the request to the end of the response, as its trace records show. ${RATE}`
        : "VS Code Copilot's trace record for this call is gone (Copilot keeps them for a few days), and the session file does not record when a response started, so the response time and output rate are unavailable.";
    case 'pi':
      return `From Pi starting the response to recording it, including waiting and retries. ${RATE}`;
    case 'opencode':
      return `From OpenCode creating the response to completing it, including waiting and retries. ${RATE}`;
    default:
      return `From the recorded start of the response to its end, including waiting and retries. ${RATE}`;
  }
}

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
