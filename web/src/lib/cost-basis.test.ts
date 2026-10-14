import { describe, expect, it } from 'vitest';
import { describeCostBasis } from './cost-basis';

describe('cost basis copy', () => {
  it.each(['piModelRates', 'sourceModelRates'] as const)(
    'labels %s as harness-recorded rather than provider billing',
    (basis) => {
      const copy = describeCostBasis(basis);
      expect(copy.label).toBe('Harness-recorded cost');
      expect(copy.totalLabel).toBe('Harness-recorded cost total');
      expect(copy.promptLabel).toBe('Harness-recorded prompt cost');
      expect(copy.note).toContain('not provider-billed charges');
      expect(copy.note).toContain('Recorded zero does not necessarily mean free');
    },
  );

  it('keeps distinct pricing bases and provider-reported labels', () => {
    expect(describeCostBasis('piModelRates').basisLabel).toBe('Configured Pi model rates');
    expect(describeCostBasis('sourceModelRates').basisLabel).toBe('Configured harness model rates');
    expect(describeCostBasis('providerReported').label).toBe('Provider-reported cost');
    expect(describeCostBasis('unknown').label).toBe('Reported cost');
  });

  it('names Copilot credits as the basis for VS Code Copilot', () => {
    const copy = describeCostBasis('unknown', 'vscode-copilot');
    expect(copy.label).toBe('Copilot-recorded cost');
    expect(copy.basisLabel).toBe('Copilot credits, at $0.01 a credit');
  });
});
