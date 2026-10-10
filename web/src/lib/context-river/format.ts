const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat();
const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 7,
});
const sessionCurrency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
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
  return value === null || value === undefined ? 'Unknown' : currency.format(value);
}

/** Round reader-facing session totals while retaining precision for very small positive values. */
export function formatSessionCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Unknown';
  return value >= 0.01 ? sessionCurrency.format(value) : formatCost(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined
    ? 'Unknown'
    : `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
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
