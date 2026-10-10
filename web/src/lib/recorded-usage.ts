import type { OutputReasoningRelationship, RecordedCallCoverage, Usage } from './types';
import { formatInteger, formatMetric } from './context-river/format';

const accountingLabels: Record<OutputReasoningRelationship, string> = {
  includesReasoning: 'Recorded output includes reasoning',
  excludesReasoning: 'Recorded output excludes reasoning',
  unknown: 'Output/reasoning overlap not established',
};

export function outputAccountingLabel(relationship: OutputReasoningRelationship): string {
  return accountingLabels[relationship];
}

/** Render source counters, not normalized totals or inferred reasoning counts. */
export function recordedResponseMetrics(usage: Usage): { label: string; value: string }[] {
  const metrics = [
    {
      label: 'Recorded output',
      value: usage.placeholder
        ? 'Unavailable'
        : usage.recordedOutput === null
          ? 'Not recorded'
          : formatMetric(usage.recordedOutput),
    },
  ];
  if (usage.reasoning !== null || usage.placeholder?.reasoning != null) {
    metrics.push({
      label: 'Recorded reasoning',
      value: usage.placeholder ? 'Unavailable' : formatMetric(usage.reasoning),
    });
  }
  return metrics;
}

/** Explain which calls a session subtotal includes, or null when it covers every call. */
export function recordedCoverageNote(coverage: RecordedCallCoverage): string | null {
  const { recordedCalls, failedAttemptCalls, missingCalls } = coverage;
  const totalCalls = recordedCalls + failedAttemptCalls + missingCalls;
  if (totalCalls === 0 || recordedCalls === totalCalls) return null;
  const parts = [`${formatInteger(recordedCalls)} of ${formatInteger(totalCalls)} calls`];
  if (failedAttemptCalls > 0) {
    parts.push(
      `${formatInteger(failedAttemptCalls)} failed attempt${failedAttemptCalls === 1 ? '' : 's'} not recorded`,
    );
  }
  return parts.join(' · ');
}
