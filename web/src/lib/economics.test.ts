import { describe, expect, it } from 'vitest';
import { describeCostBasis } from './cost-basis';
import { describeEconomicsCode } from './economics';

describe('describeEconomicsCode', () => {
  it('explains adapter-dropped writes and Pi rate costs in plain language', () => {
    expect(describeEconomicsCode('cacheWriteNotRetainedByPi')?.impact).toContain(
      'not a measured zero',
    );
    expect(describeEconomicsCode('piModelRateCostBasis')?.impact).toContain(
      'not a provider invoice',
    );
  });

  it('uses neutral cost copy for non-Pi provenance', () => {
    const copy = describeCostBasis('providerReported');
    expect(copy.label).toBe('Provider-reported cost');
    expect(copy.note).not.toContain('Pi');
    expect(describeEconomicsCode('piCostMissing', 'providerReported')).toMatchObject({
      title: 'Provider-reported cost data is missing',
    });
  });

  it('leaves unknown explanation codes available to the technical view', () => {
    expect(describeEconomicsCode('futureEconomicsCode')).toBeNull();
    expect(describeEconomicsCode('toString')).toBeNull();
  });
});
