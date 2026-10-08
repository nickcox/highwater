import type { EconomicsCostBasis } from './types';
import { describeCostBasis, isPiSource } from './cost-basis';

export interface EconomicsExplanation {
  title: string;
  impact: string;
}

const EXPLANATIONS: Record<string, EconomicsExplanation> = {
  providerUsageIncomplete: {
    title: 'Prompt usage is incomplete',
    impact: 'A required bucket is missing or could not be summed, so no cache ratios are derived.',
  },
  providerUsageMissing: {
    title: 'Prompt usage is missing',
    impact: 'This call has no persisted prompt buckets for its audited provider/API policy.',
  },
  unexpectedCacheWriteBucket: {
    title: 'Unexpected cache-write bucket',
    impact:
      'This normalized call has a nonzero write bucket outside the audited OpenAI policy, so its ratios are withheld.',
  },
  cacheWriteNotReported: {
    title: 'Cache writes are not separately reported',
    impact: 'The audited API policy does not provide a separate cache-write ratio.',
  },
  cacheWriteNotRetainedByPi: {
    title: 'Pi did not retain cache-write detail',
    impact:
      'The adapter normalizes cache writes to zero and may drop upstream write tokens; this is not a measured zero.',
  },
  cacheWriteTtlNotRetained: {
    title: 'Cache-write lifetime is unavailable',
    impact:
      'The aggregate write count does not retain its TTL split, so a prompt-cost subtotal is omitted when writes exist.',
  },
  piCostComponentsIncomplete: {
    title: 'Cost components are incomplete',
    impact: 'The available calculated total remains separate; no prompt-cost subtotal is inferred.',
  },
  piCostMissing: {
    title: 'Cost data is missing',
    impact: 'No persisted cost components are available for this call.',
  },
  piCostTotalDiffersFromComponents: {
    title: 'Cost total differs from its components',
    impact:
      'The persisted total and component values are kept independently; neither is balanced or reassigned.',
  },
  piModelRateCostBasis: {
    title: 'Cost uses model rates',
    impact:
      'This is a calculation from configured model rates, not a provider invoice or exact billed charge.',
  },
  sourceModelRateCostBasis: {
    title: 'Cost uses harness model rates',
    impact:
      'This cost was recorded by the harness using its configured model rates, not a provider invoice or exact billed charge.',
  },
  providerReportedCostBasis: {
    title: 'Cost was reported by the provider',
    impact: 'These values may not represent an invoice total.',
  },
  unknownCostBasis: {
    title: 'Cost basis is not identified',
    impact: 'Treat these values as source data rather than invoice amounts.',
  },
  unsupportedEconomicsPolicy: {
    title: 'Provider/API policy is unsupported',
    impact:
      'Raw usage remains visible, but no cache ratios or cost-component interpretation is derived.',
  },
};

export function describeEconomicsCode(
  code: string,
  costBasis: EconomicsCostBasis = 'piModelRates',
  source = 'pi',
): EconomicsExplanation | null {
  if (!Object.prototype.hasOwnProperty.call(EXPLANATIONS, code)) return null;
  const description = EXPLANATIONS[code];

  if (code === 'cacheWriteNotRetainedByPi' && !isPiSource(source)) {
    return {
      title: 'Source did not retain cache-write detail',
      impact:
        'The source normalizes cache writes to zero and may drop upstream write tokens; this is not a measured zero.',
    };
  }

  if (
    code === 'piCostComponentsIncomplete' ||
    code === 'piCostMissing' ||
    code === 'piCostTotalDiffersFromComponents'
  ) {
    const cost = describeCostBasis(costBasis);
    const costNoun = cost.label;
    if (code === 'piCostComponentsIncomplete') {
      return {
        title: `${costNoun} components are incomplete`,
        impact: `The available ${cost.totalLabel.toLowerCase()} remains separate; no prompt-cost subtotal is inferred.`,
      };
    }
    if (code === 'piCostMissing') {
      return {
        title: `${costNoun} data is missing`,
        impact: 'No persisted cost components are available for this call.',
      };
    }
    return {
      title: `${costNoun} total differs from its components`,
      impact: description.impact,
    };
  }

  if (
    code === 'piModelRateCostBasis' ||
    code === 'sourceModelRateCostBasis' ||
    code === 'providerReportedCostBasis' ||
    code === 'unknownCostBasis'
  ) {
    const cost = describeCostBasis(costBasis);
    return {
      title: `Cost uses ${cost.basisLabel.toLowerCase()}`,
      impact:
        costBasis === 'piModelRates'
          ? 'This is a calculation from configured model rates, not a provider invoice or exact billed charge.'
          : cost.note,
    };
  }

  return description;
}
