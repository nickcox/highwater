import { describe, expect, it } from 'vitest';
import { indexAnalysis } from '../analysis';
import { stableItemOrder } from './ordering';
import { testAnalysis } from './test-data';

describe('stableItemOrder', () => {
  it('is deterministic when API item arrays are shuffled', () => {
    const original = testAnalysis();
    const shuffled = { ...testAnalysis(), contextItems: [...testAnalysis().contextItems].reverse() };
    expect(stableItemOrder(indexAnalysis(shuffled))).toEqual(stableItemOrder(indexAnalysis(original)));
  });

  it('keeps retained relative order and anchors summaries near sources', () => {
    const indexed = indexAnalysis(testAnalysis());
    const order = stableItemOrder(indexed);
    expect(order.indexOf('retained')).toBeGreaterThan(order.indexOf('a'));
    expect(Math.abs(order.indexOf('summary') - order.indexOf('a'))).toBeLessThanOrEqual(1);
    expect(stableItemOrder(indexed)).toEqual(order);
  });
});
