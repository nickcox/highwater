const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat();
const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const sessionCurrency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMetric(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Unknown' : compact.format(value);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

const costTick = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  maximumSignificantDigits: 2,
});

/** Short axis labels; exact values stay in readouts and inspectors. */
export function formatCostTick(value: number): string {
  return costTick.format(value);
}

export function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Unknown';
  return value > 0 && value < 0.0001 ? `<${currency.format(0.0001)}` : currency.format(value);
}

/** Round session totals to cents without displaying positive totals as zero. */
export function formatSessionCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Unknown';
  return value > 0 && value < 0.01
    ? `<${sessionCurrency.format(0.01)}`
    : sessionCurrency.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined
    ? 'Unknown'
    : `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

/** A ratio as a percentage with one decimal place, for example 0.125 as "12.5%". */
export function formatRatioPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatWeight(value: number, unit: string): string {
  const label =
    unit === 'calculatedTokens'
      ? 'calculated tokens'
      : unit === 'estimatedTokens'
        ? 'estimated tokens'
        : unit === 'serializedBytes'
          ? 'serialized bytes'
          : unit === 'unavailable'
            ? 'unknown weight'
            : unit;
  return `${compact.format(value)} ${label}`;
}

export function chartUnitLabel(unit: string): string {
  return unit === 'calculatedTokens'
    ? 'calculated tokens'
    : unit === 'estimatedTokens'
      ? 'estimated tokens'
      : unit === 'unavailable'
        ? 'token geometry unavailable'
        : unit;
}

export function exposureLabel(value: number | null, unit: string): string {
  if (value === null) return 'Unknown';
  return unit === 'serializedBytes' || unit === 'bytes'
    ? `${compact.format(value)} byte-calls`
    : `${compact.format(value)} token-turns`;
}

export function coverageLabel(covered: number, total: number): string {
  return `${integer.format(covered)} / ${integer.format(total)}`;
}
