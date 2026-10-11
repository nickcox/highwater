import { describe, expect, it } from 'vitest';
import {
  costRateLine,
  formatAssessedCost,
  formatCostSubtotal,
  recordedByHarnessLine,
  sessionCostCoverage,
  sessionCostLines,
} from './cost-assessment';
import { costAssessmentOf, costSummaryFor, testAnalysis } from './context-river/test-data';

describe('cost assessment wording', () => {
  it('marks estimates and ranges as approximate but not recorded costs', () => {
    expect(formatAssessedCost(costAssessmentOf('recorded', 0.25))).not.toContain('≈');
    expect(formatAssessedCost(costAssessmentOf('estimated', 0.25))).toMatch(/^≈ /);
    expect(formatAssessedCost({ ...costAssessmentOf('apiEquivalent', 1), amountHigh: 2 })).toMatch(
      /^≈ \D*1\.0–\D*2\.0$/,
    );
    expect(formatAssessedCost(costAssessmentOf('unknown', null))).toBe('Unknown');
    expect(formatCostSubtotal({ low: null, high: null, calls: 0 }, true)).toBe('Unknown');
  });

  it('describes a rate by provider, date and how the date is known', () => {
    const cost = costAssessmentOf('estimated', 1);
    expect(costRateLine(cost)).toBe(
      'test rate for m, its first listed rate (date recorded by models.dev, which may lag the provider)',
    );
    // A subscription call names the API rate even when the lab is the same provider.
    const subscription = costAssessmentOf('apiEquivalent', 1);
    subscription.rate!.labEquivalent = false;
    expect(costRateLine(subscription)).toMatch(/^test API rate for m/);
    expect(costRateLine(costAssessmentOf('recorded', 1))).toBeNull();
  });

  it('repeats the recorded figure only when it differs from the amount shown', () => {
    const pi = { ...costAssessmentOf('apiEquivalent', 4), recordedByHarness: 4.9 };
    expect(recordedByHarnessLine(pi, 'pi')).toMatch(/^Recorded by Pi: \D*4\.9$/);
    expect(recordedByHarnessLine({ ...pi, recordedByHarness: 4 }, 'pi')).toBeNull();
    expect(recordedByHarnessLine(costAssessmentOf('recorded', 1), 'pi')).toBeNull();
    expect(recordedByHarnessLine({ ...pi, recordedByHarness: 0 }, 'future')).toMatch(
      /^Recorded by the harness/,
    );
  });

  it('lists billed and API-equivalent lines only when they have calls', () => {
    const analysis = testAnalysis();
    expect(sessionCostLines(costSummaryFor(analysis.modelCalls)).map((line) => line.label)).toEqual(
      ['Billed'],
    );
    analysis.modelCalls[0].costAssessment = costAssessmentOf('apiEquivalent', 2);
    const summary = costSummaryFor(analysis.modelCalls);
    expect(sessionCostLines(summary).map((line) => line.label)).toEqual([
      'Billed',
      'Subscription (API-equivalent)',
    ]);
    expect(sessionCostCoverage(summary)).toBeNull();
  });
});
