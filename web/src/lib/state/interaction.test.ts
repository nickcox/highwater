import { describe, expect, it } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from '../context-river/test-data';
import { reconcileInteraction } from './interaction';

describe('interaction reconciliation', () => {
  it('remaps calls by source identity instead of reused numeric indices', () => {
    const previous = indexAnalysis(testAnalysis());
    const replacementSource = testAnalysis();
    replacementSource.modelCalls[0].sourceRecordId = 'call2';
    replacementSource.modelCalls[1].sourceRecordId = 'call1';
    const replacement = indexAnalysis(replacementSource);

    const next = reconcileInteraction({
      hoveredCallIndex: 2,
      pinnedCallIndex: 1,
      hoveredItemId: 'a',
      selectedItemId: 'a',
    }, previous, replacement);

    expect(next.pinnedCallIndex).toBe(2);
    expect(next.hoveredCallIndex).toBe(1);
    expect(next.selectedItemId).toBe('a');
  });

  it('clears ambiguous call identities and removed items individually', () => {
    const previous = indexAnalysis(testAnalysis());
    const replacementSource = testAnalysis();
    replacementSource.modelCalls[0].sourceRecordId = 'call2';
    replacementSource.modelCalls[1].sourceRecordId = 'call2';
    const replacement = indexAnalysis(replacementSource);

    const next = reconcileInteraction({
      hoveredCallIndex: 1,
      pinnedCallIndex: 2,
      hoveredItemId: 'missing',
      selectedItemId: 'retained',
    }, previous, replacement);

    expect(next.pinnedCallIndex).toBeNull();
    expect(next.hoveredCallIndex).toBeNull();
    expect(next.hoveredItemId).toBeNull();
    expect(next.selectedItemId).toBe('retained');
  });
});
