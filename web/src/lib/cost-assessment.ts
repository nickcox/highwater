import { formatCost, formatSessionCost } from './context-river/format';
import { formatSessionTime } from './session-label';
import type { CostAssessment, CostSubtotal, CostSummary, HarnessSessionCost } from './types';

/** How the interface names a harness in sentences. */
export function harnessName(source: string): string {
  if (source === 'pi') return 'Pi';
  if (source === 'opencode') return 'OpenCode';
  if (source === 'claude-code') return 'Claude Code';
  return 'the harness';
}

/** Claude Code does not record whether a call was covered by a subscription. */
function unknownBilling(cost: CostAssessment, source: string): boolean {
  return source === 'claude-code' && cost.classificationRule === 'billingModeTable';
}

export function costKindLabel(cost: CostAssessment, source: string): string {
  if (cost.kind === 'apiEquivalent' && unknownBilling(cost, source)) return 'API rate';
  switch (cost.kind) {
    case 'recorded':
      return 'Recorded';
    case 'estimated':
      return 'Estimated';
    case 'apiEquivalent':
      return 'API-equivalent';
    case 'free':
      return 'Free';
    default:
      return 'Unknown';
  }
}

function range(low: number, high: number | null, format: (value: number) => string): string {
  return high === null || high === low ? format(low) : `${format(low)}–${format(high)}`;
}

/** A call's cost as shown in the inspector: estimates and ranges are marked "≈". */
export function formatAssessedCost(cost: CostAssessment): string {
  if (cost.amount === null) return 'Unknown';
  const text = range(cost.amount, cost.amountHigh, (value) => formatCost(value));
  return cost.kind === 'estimated' || cost.kind === 'apiEquivalent' ? `≈ ${text}` : text;
}

/** A session subtotal: whole cents, with "≈" whenever it includes estimates. */
export function formatCostSubtotal(subtotal: CostSubtotal, approximate: boolean): string {
  if (subtotal.low === null) return 'Unknown';
  const text = range(subtotal.low, subtotal.high, (value) => formatSessionCost(value));
  return approximate || subtotal.high !== subtotal.low ? `≈ ${text}` : text;
}

const dateFormat = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const BASIS_TEXT: Record<NonNullable<CostAssessment['rate']>['startBasis'], string> = {
  documented: 'date from the provider',
  firstObserved: "date first seen on the provider's pricing page",
  modelsDevCommit: 'date recorded by models.dev, which may lag the provider',
};

/** Which rate priced the call and how its start date is known. */
export function costRateLine(cost: CostAssessment): string | null {
  const rate = cost.rate;
  if (!rate) return null;
  const from = rate.validFrom
    ? `from ${dateFormat.format(new Date(rate.validFrom))}`
    : 'its first listed rate';
  // A subscription call is always priced at an API rate, even on the lab's own provider.
  const whose =
    cost.kind === 'apiEquivalent' ? `${rate.provider} API rate` : `${rate.provider} rate`;
  return `${whose} for ${rate.model}, ${from} (${BASIS_TEXT[rate.startBasis]})`;
}

/** What the harness recorded, when it differs from the amount shown. */
export function recordedByHarnessLine(cost: CostAssessment, source: string): string | null {
  if (cost.kind === 'recorded' || cost.recordedByHarness === null) return null;
  if (cost.amount !== null && cost.amountHigh === null && cost.recordedByHarness === cost.amount) {
    return null;
  }
  return `Recorded by ${harnessName(source)}: ${formatCost(cost.recordedByHarness)}`;
}

/** Why the call was priced this way, in one sentence. */
export function costRuleText(cost: CostAssessment, source: string): string {
  const harness = harnessName(source);
  switch (cost.classificationRule) {
    case 'recordedCost':
      return `Billed per token; this is the cost ${harness} recorded.`;
    case 'billingModeTable':
      if (unknownBilling(cost, source)) return "At Anthropic's API rate.";
      return cost.billingMode === 'subscription'
        ? 'This provider is covered by a subscription, so this is what the call would have cost at the API rate. It is not a charge.'
        : cost.kind === 'free'
          ? 'Billed per token, and the provider listed this model as free at the time.'
          : `Billed per token. ${harness} recorded no cost, so it is estimated at the provider's rate.`;
    case 'opencodeZeroWithListedPrice':
      return 'OpenCode recorded $0 although OpenAI listed a price, which happens when OpenCode signs in with a ChatGPT plan. Treated as a subscription: this is what the call would have cost at the API rate, not a charge.';
    case 'perTokenDefault':
      return cost.kind === 'free'
        ? 'The provider listed this model as free at the time.'
        : `${harness} recorded no cost, so it is estimated at the provider's rate.`;
    case 'failedAttempt':
      return 'The attempt failed; its recorded zeros are not a measurement, so no cost is shown.';
    case 'missingTime':
      return 'The call has no time to choose a price by.';
    case 'noPrice':
      return 'No price is known for this model at the time.';
    case 'missingUsage':
      return 'Token counts needed to estimate the cost were not recorded.';
  }
}

/** Shown under a range: why the amount is not a single figure. */
export const RANGE_EXPLANATION =
  'A range because the harness did not record whether its output count already includes reasoning tokens.';

export interface SessionCostLine {
  label: string;
  value: string;
  note: string;
  title: string;
  split: string | null;
}

/** The session's cost at API rates: what each call recorded or would cost per token,
 * including calls covered by a subscription. `split` is set only when the session has
 * both kinds of call, because only then does the total mix money spent with notional cost. */
export function sessionCost(summary: CostSummary): SessionCostLine | null {
  const parts = [summary.billed, summary.apiEquivalent].filter((part) => part.calls > 0);
  if (parts.length === 0) return null;
  const sum = (key: 'low' | 'high') =>
    parts.some((part) => part[key] === null)
      ? null
      : parts.reduce((total, part) => total + (part[key] ?? 0), 0);
  const total: CostSubtotal = {
    low: sum('low'),
    high: sum('high'),
    calls: parts.reduce((count, part) => count + part.calls, 0),
  };
  const calls = (count: number) => `${count.toLocaleString('en-AU')} call${count === 1 ? '' : 's'}`;
  return {
    label: 'Cost',
    value: formatCostSubtotal(total, true),
    note: calls(total.calls),
    title:
      'At API rates: the cost the harness recorded, or an estimate at the provider’s rate. Calls covered by a subscription are priced at what they would have cost. Not an invoice.',
    split:
      parts.length === 2
        ? `${formatCostSubtotal(summary.billed, true)} billed per token · ${formatCostSubtotal(summary.apiEquivalent, true)} covered by a subscription`
        : null,
  };
}

/** Calls without a cost, when there are any. */
export function sessionCostCoverage(summary: CostSummary): string | null {
  const parts = [];
  if (summary.unknownCalls > 0) {
    parts.push(
      `${summary.unknownCalls.toLocaleString('en-AU')} call${summary.unknownCalls === 1 ? '' : 's'} without a price`,
    );
  }
  if (summary.failedAttemptCalls > 0) {
    parts.push(
      `${summary.failedAttemptCalls.toLocaleString('en-AU')} failed attempt${summary.failedAttemptCalls === 1 ? '' : 's'} not counted`,
    );
  }
  return parts.length ? parts.join(' · ') : null;
}

/** The note under a harness's own session total: when the running total started,
 * and that it covers more than the transcript shows. */
export function harnessSessionCostNote(
  cost: HarnessSessionCost,
  source: string,
  now = new Date(),
): string {
  const since =
    cost.sinceMs === null ? null : formatSessionTime(new Date(cost.sinceMs).toISOString(), now);
  const covers = `includes subagents and ${harnessName(source)}'s own calls, which are not in this transcript`;
  return since ? `Since ${since} · ${covers}` : `Covers ${covers.replace(/^includes /, '')}`;
}
