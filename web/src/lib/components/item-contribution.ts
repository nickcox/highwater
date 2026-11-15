import type { IndexedAnalysis, ModelCall } from '../types';
import { formatInteger, formatPercent } from '../context-river/format';

/** One pass per change group; never attribute provider costs or use structural weights. */
export function itemContributions(
  indexed: IndexedAnalysis,
  ids: readonly string[],
  baseline: ModelCall | null,
  kind: 'added' | 'dropped',
) {
  const estimates = ids.map((id) =>
    baseline?.tokenizationProfileId
      ? indexed.itemById
          .get(id)
          ?.tokenEstimates.find((value) => value.profileId === baseline.tokenizationProfileId)
      : undefined,
  );
  let total = 0;
  let complete = true;
  let rangeExceeded = false;
  for (const estimate of estimates) {
    if (
      estimate?.coverage !== 'complete' ||
      estimate.tokens === null ||
      !Number.isSafeInteger(estimate.tokens) ||
      estimate.tokens < 0
    ) {
      complete = false;
      continue;
    }
    total += estimate.tokens;
    if (!Number.isSafeInteger(total)) {
      complete = false;
      rangeExceeded = true;
    }
  }
  return new Map(
    ids.map((id, index) => {
      const estimate = estimates[index];
      const tokens = estimate?.coverage !== 'unavailable' ? (estimate?.tokens ?? null) : null;
      const share = complete && total > 0 && tokens !== null ? tokens / total : null;
      const count =
        tokens === null
          ? 'Token estimate unknown'
          : `${estimate?.coverage === 'partial' ? 'Partial estimate' : 'Estimated'} ${formatInteger(tokens)} tokens`;
      const reason =
        tokens === null
          ? 'item estimate unavailable'
          : rangeExceeded
            ? `${kind} token total exceeds supported numeric range`
            : !complete
              ? `${kind} token total incomplete or unavailable`
              : `${kind} token total is zero`;
      const detail =
        share === null
          ? `${count}; share unavailable${baseline ? ` for call ${baseline.index} (${reason})` : ' (no previous call)'}`
          : `${count}; ${formatPercent(share)} of estimated ${kind} tokens (call ${baseline!.index})`;
      return [id, { share, detail }] as const;
    }),
  );
}

/**
 * Estimated tokens for added or dropped items, using the baseline call's tokenization profile:
 * the call itself for added items and the previous call for dropped ones. `complete` is false
 * when any item has no complete estimate, so a total is then a lower bound.
 */
export function changeTokens(
  indexed: IndexedAnalysis,
  ids: readonly string[],
  baseline: ModelCall | null,
) {
  const items = new Map<string, { tokens: number | null; partial: boolean }>();
  let total = 0;
  let complete = true;
  for (const id of ids) {
    const estimate = baseline?.tokenizationProfileId
      ? indexed.itemById
          .get(id)
          ?.tokenEstimates.find((value) => value.profileId === baseline.tokenizationProfileId)
      : undefined;
    const tokens =
      estimate &&
      estimate.coverage !== 'unavailable' &&
      estimate.tokens !== null &&
      Number.isSafeInteger(estimate.tokens) &&
      estimate.tokens >= 0
        ? estimate.tokens
        : null;
    const partial = tokens === null || estimate?.coverage !== 'complete';
    if (partial) complete = false;
    if (tokens !== null) total += tokens;
    items.set(id, { tokens, partial });
  }
  return { items, total, complete };
}

/** Order item IDs by estimated tokens, largest first; unknown sizes last, otherwise stable. */
export function largestFirst(
  ids: readonly string[],
  items: ReadonlyMap<string, { tokens: number | null }>,
): string[] {
  return ids
    .map((id, position) => ({ id, position, tokens: items.get(id)?.tokens ?? null }))
    .sort(
      (left, right) => (right.tokens ?? -1) - (left.tokens ?? -1) || left.position - right.position,
    )
    .map((entry) => entry.id);
}
