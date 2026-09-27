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
    label: 'Pi-calculated cost',
    totalLabel: 'Pi-calculated cost total',
    promptLabel: 'Pi-calculated prompt cost',
    componentPrefix: 'Pi-rate',
    basisLabel: 'Configured Pi model rates',
    note: 'Cost amounts use configured Pi model rates, not provider-billed charges. Custom rates may be zero.',
    trackCaveat: 'not provider billed',
  },
  sourceModelRates: {
    label: 'Source-calculated cost',
    totalLabel: 'Source-calculated cost total',
    promptLabel: 'Source-calculated prompt cost',
    componentPrefix: 'Source-rate',
    basisLabel: 'Configured source model rates',
    note: 'Cost amounts use rates configured by the session source, not provider-billed charges.',
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

export function describeCostBasis(basis: EconomicsCostBasis): CostBasisCopy {
  return COST_BASIS_COPY[basis] ?? COST_BASIS_COPY.unknown;
}

export function isPiSource(source: string): boolean {
  return source === 'pi';
}

export function usageNormalizationLabel(source: string): string {
  return isPiSource(source) ? 'Pi-normalized' : 'Source-normalized';
}
