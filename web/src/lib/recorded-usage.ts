import type { OutputReasoningRelationship, Usage } from './types';
import { formatMetric } from './context-river/format';

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
      value: usage.recordedOutput === null ? 'Not recorded' : formatMetric(usage.recordedOutput),
    },
  ];
  if (usage.reasoning !== null) {
    metrics.push({ label: 'Recorded reasoning', value: formatMetric(usage.reasoning) });
  }
  return metrics;
}
