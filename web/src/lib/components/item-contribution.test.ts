import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { testAnalysis } from '../context-river/test-data';
import { itemContributions } from './item-contribution';

function fixture() {
  const indexed = indexTestAnalysis(testAnalysis());
  const call = indexed.analysis.modelCalls[0];
  indexed.itemById.get('a')!.tokenEstimates[0].tokens = 25;
  indexed.itemById.get('retained')!.tokenEstimates[0].tokens = 75;
  return { indexed, call };
}

describe('change-group contribution shares', () => {
  it('uses only the listed items, regardless of accumulated context, framing or provider usage', () => {
    const { indexed, call } = fixture();
    call.tokenAnalysis.calculatedVisibleTokens = 1_000_000;
    call.reportedPromptTokens = 2_000_000;
    call.tokenAnalysis.calculatedRequestTokens = 1_000_050;
    const values = itemContributions(indexed, ['a', 'retained'], call, 'added');
    expect([...values.keys()]).toEqual(['a', 'retained']);
    expect(values.get('a')).toEqual({
      share: 0.25,
      detail: 'Estimated 25 tokens; 25% of estimated added tokens (call 1)',
    });
    expect(values.get('retained')!.share).toBe(0.75);
    expect(itemContributions(indexed, ['a'], call, 'added').get('a')!.share).toBe(1);
  });
  it('does not let unrelated incomplete retained context suppress complete change estimates', () => {
    const { indexed, call } = fixture();
    call.tokenAnalysis.calculatedVisibleTokens = null;
    call.tokenAnalysis.estimateCoverage.unavailableItems = 1;
    expect(itemContributions(indexed, ['a', 'retained'], call, 'added').get('a')!.share).toBe(0.25);
  });
  it('uses the supplied previous profile for dropped tokens without falling back to another profile', () => {
    const { indexed, call } = fixture();
    indexed.itemById.get('a')!.tokenEstimates.push({
      ...indexed.itemById.get('a')!.tokenEstimates[0],
      profileId: 'previous',
      tokens: 60,
    });
    indexed.itemById.get('retained')!.tokenEstimates.push({
      ...indexed.itemById.get('retained')!.tokenEstimates[0],
      profileId: 'previous',
      tokens: 40,
    });
    call.tokenizationProfileId = 'previous';
    const value = itemContributions(indexed, ['a', 'retained'], call, 'dropped').get('a')!;
    expect(value.share).toBe(0.6);
    expect(value.detail).toContain('estimated dropped tokens');
    call.tokenizationProfileId = 'missing';
    expect(itemContributions(indexed, ['a'], call, 'dropped').get('a')!.share).toBeNull();
    expect(itemContributions(indexed, ['a'], null, 'dropped').get('a')!.detail).toContain(
      'no previous call',
    );
  });
  it('keeps real zero distinct from unknown and qualifies the whole group when any estimate is incomplete', () => {
    const { indexed, call } = fixture();
    const estimate = indexed.itemById.get('a')!.tokenEstimates[0];
    estimate.tokens = 0;
    expect(itemContributions(indexed, ['a', 'retained'], call, 'added').get('a')!.share).toBe(0);
    for (const coverage of ['partial', 'unavailable'] as const) {
      estimate.coverage = coverage;
      const values = itemContributions(indexed, ['a', 'retained'], call, 'added');
      expect(values.get('a')!.share).toBeNull();
      expect(values.get('retained')!.share).toBeNull();
    }
    estimate.coverage = 'complete';
    estimate.tokens = null;
    expect(
      itemContributions(indexed, ['a', 'retained'], call, 'added').get('retained')!.share,
    ).toBeNull();
  });
  it('does not fabricate percentages for all-zero groups or overflowed totals', () => {
    const { indexed, call } = fixture();
    indexed.itemById.get('a')!.tokenEstimates[0].tokens = 0;
    expect(itemContributions(indexed, ['a'], call, 'added').get('a')!.share).toBeNull();
    indexed.itemById.get('a')!.tokenEstimates[0].tokens = Number.MAX_SAFE_INTEGER;
    expect(itemContributions(indexed, ['a', 'retained'], call, 'added').get('a')!.share).toBeNull();
    expect(itemContributions(indexed, [], call, 'added').size).toBe(0);
  });
});
