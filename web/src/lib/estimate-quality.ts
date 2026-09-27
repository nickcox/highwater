import type { SessionAnalysis } from './types';

export type EstimateQualityTone = 'info' | 'warning' | 'unavailable';

export interface EstimateQuality {
  tone: EstimateQualityTone;
  label: string;
  message: string;
  rawFallbackCode: string | null;
}

function unitLabel(analysis: SessionAnalysis): string {
  return analysis.displayWeightUnit === 'calculatedTokens'
    ? 'Calculated tokens'
    : 'Estimated tokens';
}

function fallbackMessage(code: string | null): string | null {
  switch (code) {
    case null:
      return null;
    case 'best-effort-tokenization':
      return 'Some item weights use best-effort local token estimates.';
    case 'tokenizationDisabled':
      return 'Token analysis is disabled; token-weighted geometry is unavailable.';
    case 'partial-token-coverage':
      return 'Some context items do not have complete token estimates.';
    default:
      return 'A fallback estimation method is in use; see Session details for its method and diagnostics.';
  }
}

export function estimateQuality(analysis: SessionAnalysis): EstimateQuality {
  const rawFallbackCode = analysis.tokenAnalysis.fallbackReason;
  if (analysis.displayWeightUnit === 'unavailable') {
    return {
      tone: 'unavailable',
      label: 'Token geometry unavailable · structural view',
      message:
        'Item token widths are unavailable. The river shows structural placeholders, not measured token sizes.',
      rawFallbackCode,
    };
  }

  const coverage = analysis.tokenAnalysis.itemEstimateCoverage;
  if (coverage.partialItems > 0 || coverage.unavailableItems > 0) {
    return {
      tone: 'warning',
      label: `${unitLabel(analysis)} · partial coverage`,
      message:
        'Some context items have partial or unavailable token estimates. Geometry uses available local estimates only; provider-reported prompt usage remains separate.',
      rawFallbackCode,
    };
  }

  const fallback = fallbackMessage(rawFallbackCode);
  return {
    tone: 'info',
    label: unitLabel(analysis),
    message:
      fallback ??
      'Token sizes are calculated locally from context items. Provider-reported prompt usage can include framing and serialization not assigned to items.',
    rawFallbackCode,
  };
}
