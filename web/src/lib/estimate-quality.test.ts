import { describe, expect, it } from 'vitest';
import { testAnalysis } from './context-river/test-data';
import { indexTestAnalysis } from './testing/wire-analysis';
import { estimateSummary } from './estimate-quality';
import type { IndexedAnalysis } from './types';

function indexed(): IndexedAnalysis {
  return indexTestAnalysis(testAnalysis());
}

/** A session whose estimates were compared with the reported input on 12 calls. */
function reconciled(medianShare: number): IndexedAnalysis {
  const value = indexed();
  value.analysis.session.reconciliationComparableCalls = 12;
  value.analysis.session.medianAbsoluteResidualPercent = medianShare;
  return value;
}

describe('estimate summary', () => {
  it('rates estimates by their median gap from the reported input', () => {
    expect(estimateSummary(reconciled(0.01)).level).toBe('good');
    expect(estimateSummary(reconciled(0.05)).level).toBe('partial');
    expect(estimateSummary(reconciled(0.2)).level).toBe('rough');
    const good = estimateSummary(reconciled(0.005));
    expect(good.label).toBe('Estimates: good');
    expect(good.lead).toContain('differ from the input the provider reported by 0.5%');
    expect(good.lead).toContain('12 calls');
  });

  it('rates by counting method when nothing can be compared', () => {
    const value = indexed();
    value.analysis.tokenAnalysis.tokenizerMethods = { characterHeuristic: 3 };
    const summary = estimateSummary(value);
    expect(summary.level).toBe('rough');
    expect(summary.lead).toContain('No call has reported input to compare against');
    expect(summary.reasons).toContain(
      'Some tokens are estimated from character counts, which is rough.',
    );
  });

  it('lists only the reasons that apply, in plain language', () => {
    const value = reconciled(0.01);
    value.analysis.tokenAnalysis.itemEstimateCoverage.partialItems = 2;
    value.analysis.reconstruction = {
      status: 'partial',
      explanationCodes: ['missingHistoricalSystemPrompt'],
    };
    const { reasons } = estimateSummary(value);
    expect(reasons).toContain('Historical system instructions are not recorded completely.');
    expect(reasons.some((reason) => reason.startsWith('2 of '))).toBe(true);
    expect(reasons.join(' ')).not.toMatch(/partial-token-coverage|apiSerializationEstimate/);
  });

  it('gives explanations that apply to every call once, unless another reason covers them', () => {
    const value = reconciled(0.01);
    for (const call of value.analysis.modelCalls) {
      call.tokenAnalysis.explanationCodes = ['providerUsageIncomplete', 'heuristicTokenizer'];
    }
    value.analysis.modelCalls[0].tokenAnalysis.explanationCodes.push('unsupportedImage');
    const { reasons } = estimateSummary(value);
    expect(
      reasons.filter((reason) => reason.startsWith('Provider usage is incomplete')),
    ).toHaveLength(1);
    expect(reasons.join(' ')).not.toContain('A character heuristic was used');
    expect(reasons.join(' ')).not.toContain('Image content');
  });

  it('says plainly when token sizes are unavailable', () => {
    const value = indexed();
    value.analysis.displayWeightUnit = 'unavailable';
    value.analysis.tokenAnalysis.fallbackReason = 'tokenizationDisabled';
    const summary = estimateSummary(value);
    expect(summary.level).toBe('unavailable');
    expect(summary.label).toBe('Estimates: unavailable');
    expect(summary.reasons[0]).toBe('Token counting is turned off for this server.');
  });
});
