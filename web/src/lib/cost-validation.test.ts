import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from './testing/wire-analysis';
import { costSummaryFor, testAnalysis } from './context-river/test-data';
import type { CostAssessment, SessionAnalysis } from './types';

const rate: CostAssessment['rate'] = {
  provider: 'openai',
  model: 'gpt-6.1-sol',
  labEquivalent: true,
  validFrom: null,
  startBasis: 'modelsDevCommit',
  source: 'https://github.com/sst/models.dev/commit/abc',
};
const apiEquivalent: CostAssessment = {
  kind: 'apiEquivalent',
  amount: 1.5,
  amountHigh: 1.8,
  recordedByHarness: 1.4,
  billingMode: 'subscription',
  classificationRule: 'billingModeTable',
  rate,
};

function withCost(cost: Partial<CostAssessment>): SessionAnalysis {
  const analysis = structuredClone(testAnalysis());
  analysis.modelCalls[1].costAssessment = { ...apiEquivalent, ...cost };
  analysis.session.costSummary = costSummaryFor(analysis.modelCalls);
  return analysis;
}

describe('cost assessment validation', () => {
  it('accepts an API-equivalent range and the matching summary', () => {
    const indexed = indexTestAnalysis(withCost({}));
    expect(indexed.analysis.session.costSummary.apiEquivalent).toEqual({
      low: 1.5,
      high: 1.8,
      calls: 1,
    });
  });

  it.each<[string, Partial<CostAssessment>]>([
    ['an unknown kind', { kind: 'guessed' as CostAssessment['kind'] }],
    ['an unknown rule', { classificationRule: 'other' as CostAssessment['classificationRule'] }],
    ['a negative amount', { amount: -1 }],
    ['an unknown cost with an amount', { kind: 'unknown', billingMode: null }],
    ['a known cost without an amount', { amount: null, amountHigh: null }],
    ['a range below its amount', { amountHigh: 1 }],
    ['an API-equivalent cost without a subscription', { billingMode: 'perToken' }],
    ['a lab rate outside a subscription', { kind: 'estimated', billingMode: 'perToken' }],
    ['an estimate without a rate', { kind: 'estimated', billingMode: 'perToken', rate: null }],
    ['an invalid rate date', { rate: { ...rate!, validFrom: 'yesterday' } }],
  ])('rejects %s', (_, cost) => {
    expect(() => indexTestAnalysis(withCost(cost))).toThrow(/cost/);
  });

  it('rejects an inconsistent session summary', () => {
    const empty = withCost({});
    empty.session.costSummary.apiEquivalent = { low: 1, high: 1, calls: 0 };
    expect(() => indexTestAnalysis(empty)).toThrow(/API-equivalent cost subtotal/);
    const reversed = withCost({});
    reversed.session.costSummary.billed = { low: 2, high: 1, calls: 3 };
    expect(() => indexTestAnalysis(reversed)).toThrow(/billed cost subtotal/);
    const missing = withCost({});
    delete (missing.session as Partial<SessionAnalysis['session']>).costSummary;
    expect(() => indexTestAnalysis(missing)).toThrow(/no cost summary/);
  });
  it("accepts the harness's own session total and rejects invalid ones", () => {
    const valid = withCost({});
    valid.session.harnessSessionCost = { totalUsd: 2.28, sinceMs: 1790812800000 };
    expect(indexTestAnalysis(valid).analysis.session.harnessSessionCost).toEqual({
      totalUsd: 2.28,
      sinceMs: 1790812800000,
    });
    for (const cost of [
      { totalUsd: -1, sinceMs: null },
      { totalUsd: Number.NaN, sinceMs: null },
      { totalUsd: 1, sinceMs: 1.5 },
    ]) {
      const invalid = withCost({});
      invalid.session.harnessSessionCost = cost;
      expect(() => indexTestAnalysis(invalid)).toThrow(/harness session cost/);
    }
    const missing = withCost({});
    delete (missing.session as Partial<SessionAnalysis['session']>).harnessSessionCost;
    expect(() => indexTestAnalysis(missing)).toThrow(/harness session cost/);
  });
});
