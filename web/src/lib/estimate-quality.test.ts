import { describe, expect, it } from 'vitest';
import { testAnalysis } from './context-river/test-data';
import { estimateQuality } from './estimate-quality';

describe('estimate quality', () => {
  it('describes ordinary local estimates as information rather than a warning', () => {
    const quality = estimateQuality(testAnalysis());
    expect(quality.tone).toBe('info');
    expect(quality.label).toBe('Estimated tokens');
    expect(quality.message).toContain('best-effort local token estimates');
  });

  it('uses one plain-language warning for partial coverage', () => {
    const analysis = testAnalysis();
    analysis.tokenAnalysis.itemEstimateCoverage.partialItems = 1;
    analysis.tokenAnalysis.fallbackReason = 'partial-token-coverage';
    const quality = estimateQuality(analysis);
    expect(quality.tone).toBe('warning');
    expect(quality.label).toBe('Estimated tokens · partial coverage');
    expect(quality.message).toContain('Some context items have partial or unavailable');
    expect(quality.rawFallbackCode).toBe('partial-token-coverage');
    expect(quality.message).not.toContain('partial-token-coverage');
  });

  it('keeps unavailable token geometry explicit and structural', () => {
    const analysis = testAnalysis();
    analysis.displayWeightUnit = 'unavailable';
    analysis.tokenAnalysis.chartUnit = 'unavailable';
    const quality = estimateQuality(analysis);
    expect(quality.tone).toBe('unavailable');
    expect(quality.label).toBe('Token geometry unavailable · structural view');
    expect(quality.message).toContain('not measured token sizes');
  });

  it('does not expose an unknown fallback identifier in the user-facing message', () => {
    const analysis = testAnalysis();
    analysis.tokenAnalysis.fallbackReason = 'future-internal-code';
    const quality = estimateQuality(analysis);
    expect(quality.message).toContain('fallback estimation method');
    expect(quality.message).not.toContain('future-internal-code');
    expect(quality.rawFallbackCode).toBe('future-internal-code');
  });
});
