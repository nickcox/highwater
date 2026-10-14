import type { EconomicsCostBasis } from './types';

export interface CostBasisCopy {
  label: string;
  totalLabel: string;
  promptLabel: string;
  componentPrefix: string;
  basisLabel: string;
  note: string;
  trackCaveat: string;
}

const COST_BASIS_COPY: Record<EconomicsCostBasis, CostBasisCopy> = {
  piModelRates: {
    label: 'Harness-recorded cost',
    totalLabel: 'Harness-recorded cost total',
    promptLabel: 'Harness-recorded prompt cost',
    componentPrefix: 'Pi-rate',
    basisLabel: 'Configured Pi model rates',
    note: 'Cost recorded by Pi using configured model rates, not provider-billed charges. Recorded zero does not necessarily mean free.',
    trackCaveat: 'not provider billed',
  },
  sourceModelRates: {
    label: 'Harness-recorded cost',
    totalLabel: 'Harness-recorded cost total',
    promptLabel: 'Harness-recorded prompt cost',
    componentPrefix: 'Harness-rate',
    basisLabel: 'Configured harness model rates',
    note: 'Cost recorded by the harness using its configured model rates, not provider-billed charges. Recorded zero does not necessarily mean free.',
    trackCaveat: 'not provider billed',
  },
  providerReported: {
    label: 'Provider-reported cost',
    totalLabel: 'Provider-reported cost total',
    promptLabel: 'Provider-reported prompt cost',
    componentPrefix: 'Reported',
    basisLabel: 'Provider-reported',
    note: 'Cost amounts were reported by the provider and may not represent an invoice total.',
    trackCaveat: 'reported by the provider',
  },
  unknown: {
    label: 'Reported cost',
    totalLabel: 'Reported cost total',
    promptLabel: 'Reported prompt cost',
    componentPrefix: 'Reported',
    basisLabel: 'Not identified',
    note: 'The cost basis is not identified; treat these values as source data rather than invoice amounts.',
    trackCaveat: 'cost basis not identified',
  },
};

/** Claude Code records token usage but no cost, so there is no recorded cost to
 * describe; the session's costs come from the price table. */
const CLAUDE_CODE_COPY: CostBasisCopy = {
  ...COST_BASIS_COPY.unknown,
  basisLabel: 'None: Claude Code records no cost',
  note: 'Claude Code records token usage but no cost for each call, so costs are calculated from the price table.',
  trackCaveat: 'no recorded cost',
};

export function describeCostBasis(basis: EconomicsCostBasis, source?: string): CostBasisCopy {
  if (source === 'claude-code') return CLAUDE_CODE_COPY;
  return COST_BASIS_COPY[basis] ?? COST_BASIS_COPY.unknown;
}

export function isPiSource(source: string): boolean {
  return source === 'pi';
}

export function usageNormalizationLabel(source: string): string {
  return isPiSource(source) ? 'Pi-normalized' : 'Source-normalized';
}
