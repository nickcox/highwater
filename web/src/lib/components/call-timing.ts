const RATE = 'The rate is reported output, including reasoning, over that time.';

/** What a call's response time measures, for the source that recorded it. */
export function timingExplanation(source: string): string {
  switch (source) {
    case 'claude-code':
      return 'Claude Code does not record when a request started, so the response time and output rate are unavailable.';
    case 'vscode-copilot':
      return 'VS Code Copilot records when each response finished but not when it started, so the response time and output rate are unavailable.';
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
