import { describe, expect, it } from 'vitest';
import { describeTokenDiagnostic } from './diagnostics';

describe('describeTokenDiagnostic', () => {
  it('explains known diagnostic codes and their impact in plain language', () => {
    expect(describeTokenDiagnostic('providerUsageIncomplete')).toEqual({
      title: 'Provider usage is incomplete',
      impact: 'Prompt reconciliation may be unavailable or partial.',
    });
    expect(describeTokenDiagnostic('heuristicTokenizer')?.impact).toMatch(/rough estimate/);
    expect(describeTokenDiagnostic('unsupportedImage')?.impact).toMatch(/image payload/);
    expect(describeTokenDiagnostic('negativeResidual')?.impact).toMatch(/negative residual/);
  });

  it('leaves unknown codes for technical details instead of inventing a meaning', () => {
    expect(describeTokenDiagnostic('futureDiagnostic')).toBeNull();
  });
});
