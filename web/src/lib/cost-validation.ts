import { AnalysisValidationError } from './analysis-validation';
import type {
  CostAssessment,
  CostSubtotal,
  CostSummary,
  HarnessSessionCost,
  ModelCall,
} from './types';

const KINDS = new Set(['recorded', 'estimated', 'apiEquivalent', 'free', 'unknown']);
const RULES = new Set([
  'recordedCost',
  'billingModeTable',
  'opencodeZeroWithListedPrice',
  'perTokenDefault',
  'claudeCodeBillingSetting',
  'failedAttempt',
  'missingTime',
  'noPrice',
  'missingUsage',
]);
const BASES = new Set(['documented', 'firstObserved', 'modelsDevCommit']);

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** A call's cost assessment must say what it is and agree with itself: only unknown
 * costs lack an amount, and only a range has a high end above the amount. */
export function assertCostAssessment(call: ModelCall): void {
  const cost: CostAssessment | undefined = call.costAssessment;
  const fail = (reason: string): never => {
    throw new AnalysisValidationError(`Model call ${call.index} cost ${reason}`);
  };
  if (!cost || !KINDS.has(cost.kind)) fail('has an unknown kind');
  if (!RULES.has(cost.classificationRule)) fail('has an unknown classification rule');
  if (cost.amount !== null && !isAmount(cost.amount)) fail('has an invalid amount');
  if ((cost.kind === 'unknown') !== (cost.amount === null)) fail('amount disagrees with its kind');
  if (
    cost.amountHigh !== null &&
    (!isAmount(cost.amountHigh) || cost.amount === null || cost.amountHigh < cost.amount)
  ) {
    fail('has an invalid range');
  }
  if (cost.recordedByHarness !== null && !isAmount(cost.recordedByHarness)) {
    fail('has an invalid recorded value');
  }
  if (cost.billingMode !== null && !['perToken', 'subscription'].includes(cost.billingMode)) {
    fail('has an unknown billing mode');
  }
  if (
    (cost.kind === 'apiEquivalent') !==
    (cost.billingMode === 'subscription' && cost.amount !== null)
  ) {
    fail('is API-equivalent without a subscription, or the reverse');
  }
  const rate = cost.rate;
  if (rate !== null) {
    if (
      typeof rate.provider !== 'string' ||
      typeof rate.model !== 'string' ||
      typeof rate.labEquivalent !== 'boolean' ||
      typeof rate.source !== 'string' ||
      !BASES.has(rate.startBasis) ||
      (rate.validFrom !== null && Number.isNaN(Date.parse(rate.validFrom)))
    ) {
      fail('has an invalid rate');
    }
    if (rate.labEquivalent && cost.kind !== 'apiEquivalent') {
      fail('uses a lab rate outside a subscription');
    }
  }
  if ((cost.kind === 'estimated' || cost.kind === 'apiEquivalent') && rate === null) {
    fail('is calculated without a rate');
  }
}

function assertSubtotal(subtotal: CostSubtotal | undefined, description: string): void {
  const fail = (): never => {
    throw new AnalysisValidationError(`Session ${description} cost subtotal is inconsistent`);
  };
  if (!subtotal || !isCount(subtotal.calls)) fail();
  const { low, high, calls } = subtotal!;
  if (calls === 0) {
    if (low !== null || high !== null) fail();
    return;
  }
  // A non-finite sum is reported as null on both ends.
  if (low === null && high === null) return;
  if (!isAmount(low) || !isAmount(high) || high < low) fail();
}

/** Like the other session subtotals, the cost summary is checked for internal
 * consistency; each call's assessment is checked separately. */
export function assertCostSummary(summary: CostSummary | undefined): void {
  if (!summary) throw new AnalysisValidationError('Session has no cost summary');
  assertSubtotal(summary.billed, 'billed');
  assertSubtotal(summary.apiEquivalent, 'API-equivalent');
  if (!isCount(summary.unknownCalls) || !isCount(summary.failedAttemptCalls)) {
    throw new AnalysisValidationError('Session cost summary has invalid call counts');
  }
  const data = summary.priceData;
  if (
    !data ||
    typeof data.modelsDevCommit !== 'string' ||
    typeof data.modelsDevCommittedAt !== 'string' ||
    (data.amendmentsImportedFrom !== null && typeof data.amendmentsImportedFrom !== 'string')
  ) {
    throw new AnalysisValidationError('Session cost summary has no price data source');
  }
}

/** Claude Code's own total is optional, but when present it must be an amount, with
 * a valid start time or none. */
export function assertHarnessSessionCost(cost: HarnessSessionCost | null | undefined): void {
  if (cost === null) return;
  if (
    !cost ||
    !isAmount(cost.totalUsd) ||
    (cost.sinceMs !== null && !(Number.isSafeInteger(cost.sinceMs) && cost.sinceMs >= 0))
  ) {
    throw new AnalysisValidationError('Session has an invalid harness session cost');
  }
}
