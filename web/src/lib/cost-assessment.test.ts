import { describe, expect, it } from 'vitest';
import {
  costKindLabel,
  costRateLine,
  costRuleText,
  formatAssessedCost,
  formatCostSubtotal,
  recordedByHarnessLine,
  sessionCost,
  sessionCostCoverage,
} from './cost-assessment';
import { costAssessmentOf, costSummaryFor, testAnalysis } from './context-river/test-data';

describe('cost assessment wording', () => {
  it('shows Claude Code calls at the API rate without claiming a subscription', () => {
    const subscription = {
      ...costAssessmentOf('apiEquivalent', 1),
      billingMode: 'subscription' as const,
      classificationRule: 'billingModeTable' as const,
    };
    expect(costRuleText(subscription, 'claude-code')).toBe("At Anthropic's API rate.");
    expect(costKindLabel(subscription, 'claude-code')).toBe('API rate');
    expect(costRuleText(subscription, 'pi')).toMatch(/covered by a subscription/);
    expect(costKindLabel(subscription, 'pi')).toBe('API-equivalent');
  });

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

  it('shows one cost, split only when billed and subscription calls are mixed', () => {
    const analysis = testAnalysis();
    const billedOnly = sessionCost(costSummaryFor(analysis.modelCalls))!;
    expect(billedOnly.label).toBe('Cost');
    expect(billedOnly.split).toBeNull();
    analysis.modelCalls[0].costAssessment = costAssessmentOf('apiEquivalent', 2);
    const summary = costSummaryFor(analysis.modelCalls);
    const mixed = sessionCost(summary)!;
    expect(mixed.note).toBe(
      `${analysis.modelCalls.length} call${analysis.modelCalls.length === 1 ? '' : 's'}`,
    );
    expect(mixed.value).toBe(
      formatCostSubtotal(
        {
          low: (summary.billed.low ?? 0) + (summary.apiEquivalent.low ?? 0),
          high: (summary.billed.high ?? 0) + (summary.apiEquivalent.high ?? 0),
          calls: summary.billed.calls + summary.apiEquivalent.calls,
        },
        true,
      ),
    );
    expect(mixed.split).toMatch(/billed per token · .* covered by a subscription$/);
    expect(sessionCostCoverage(summary)).toBeNull();
    expect(
      sessionCost({
        ...summary,
        billed: { low: null, high: null, calls: 0 },
        apiEquivalent: { low: null, high: null, calls: 0 },
      }),
    ).toBeNull();
  });
});
