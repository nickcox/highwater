import { describe, expect, it } from 'vitest';
import { testAnalysis } from './context-river/test-data';
import { outputAccountingLabel, recordedResponseMetrics } from './recorded-usage';

describe('recorded response counters', () => {
  it.each(['includesReasoning', 'excludesReasoning', 'unknown'] as const)(
    'does not combine counters or substitute normalized totals for %s',
    (relationship) => {
      const usage = {
        ...testAnalysis().modelCalls[0].usage,
        recordedOutput: 20,
        reasoning: 10,
        output: 999,
        outputReasoningRelationship: relationship,
      };
      expect(recordedResponseMetrics(usage)).toEqual([
        { label: 'Recorded output', value: '20' },
        { label: 'Recorded reasoning', value: '10' },
      ]);
      expect(usage.output).toBe(999);
    },
  );

  it('retains an independent reasoning counter when output is not recorded', () => {
    const usage = { ...testAnalysis().modelCalls[0].usage, recordedOutput: null, reasoning: 10 };
    expect(recordedResponseMetrics(usage)).toEqual([
      { label: 'Recorded output', value: 'Not recorded' },
      { label: 'Recorded reasoning', value: '10' },
    ]);
  });

  it('puts accounting semantics in descriptive copy, not a prominent warning', () => {
    expect(outputAccountingLabel('includesReasoning')).toBe('Recorded output includes reasoning');
    expect(outputAccountingLabel('excludesReasoning')).toBe('Recorded output excludes reasoning');
    expect(outputAccountingLabel('unknown')).toBe('Output/reasoning overlap not established');
  });
});
