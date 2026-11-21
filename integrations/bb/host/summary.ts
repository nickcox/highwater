import { z } from 'zod';
import type { Summary } from '../contract';
import { contextItemKind, type ContextComposition, type ContextItemKind } from '../state';
import { HostFailure } from './http';

const tokens = z
  .union([
    z.number().int().nonnegative().safe(),
    z
      .string()
      .regex(/^\d+$/)
      .refine((value) => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER))
      .transform(Number),
  ])
  .nullable();
const analysisSchema = z.object({
  schemaVersion: z.literal(1),
  modelCalls: z.array(
    z.object({
      reportedPromptTokens: tokens,
      compactionBefore: z.string().nullable().optional(),
      contextItemIndexes: z.unknown().optional(),
      tokenizationProfileId: z.unknown().optional(),
    }),
  ),
  compactions: z.array(z.unknown()),
  contextItems: z.unknown().optional(),
});
const itemIndexes = z.array(z.number().int().nonnegative().safe());
const contextItem = z.object({
  kind: contextItemKind.catch('other'),
  tokenEstimates: z.array(
    z.object({
      profileId: z.string(),
      tokens: tokens.catch(null),
      coverage: z.enum(['complete', 'partial', 'unavailable']).catch('unavailable'),
    }),
  ),
});

function latestComposition(
  analysis: z.infer<typeof analysisSchema>,
): ContextComposition | undefined {
  const call = analysis.modelCalls.at(-1);
  const items: unknown = analysis.contextItems;
  if (typeof call?.tokenizationProfileId !== 'string' || !Array.isArray(items)) return;
  const indexes = itemIndexes.safeParse(call.contextItemIndexes);
  if (!indexes.success) return;
  const totals = new Map<ContextItemKind, number>();
  let total = 0;
  let incomplete = false;
  for (const index of new Set(indexes.data)) {
    const item = contextItem.safeParse(items[index]);
    if (!item.success) {
      incomplete = true;
      continue;
    }
    const estimate = item.data.tokenEstimates.find(
      ({ profileId }) => profileId === call.tokenizationProfileId,
    );
    if (estimate?.coverage !== 'complete' || estimate.tokens === null) incomplete = true;
    const count = estimate?.tokens ?? 0;
    if (count === 0) continue;
    total += count;
    if (!Number.isSafeInteger(total)) return;
    totals.set(item.data.kind, (totals.get(item.data.kind) ?? 0) + count);
  }
  if (!total) return;
  return {
    segments: contextItemKind.options.flatMap((kind) => {
      const count = totals.get(kind);
      return count === undefined ? [] : [{ kind, tokens: count }];
    }),
    incomplete,
  };
}

export function summariseAnalysis(input: unknown): Summary {
  const parsed = analysisSchema.safeParse(input);
  if (!parsed.success)
    throw new HostFailure(
      502,
      'analysisInvalid',
      'Highwater returned an unsupported or invalid analysis for the context summary.',
    );
  const analysis = parsed.data;
  const binCount = Math.min(60, analysis.modelCalls.length);
  const binOf = (index: number) => Math.floor((index * binCount) / analysis.modelCalls.length);
  const bins = new Map<number, number>();
  let peak: number | null = null;
  analysis.modelCalls.forEach((call, index) => {
    const value = call.reportedPromptTokens;
    if (value === null) return;
    peak = peak === null ? value : Math.max(peak, value);
    const bin = binOf(index);
    bins.set(bin, Math.max(bins.get(bin) ?? 0, value));
  });
  // Positions in `series` of the points whose calls include one just after a compaction.
  const binIndices = [...bins.keys()];
  const compactionPoints = [
    ...new Set(
      analysis.modelCalls.flatMap((call, index) =>
        call.compactionBefore ? [binIndices.indexOf(binOf(index))] : [],
      ),
    ),
  ].filter((position) => position >= 0);
  const composition = latestComposition(analysis);
  return {
    callCount: analysis.modelCalls.length,
    compactionCount: analysis.compactions.length,
    latestInputTokens: analysis.modelCalls.at(-1)?.reportedPromptTokens ?? null,
    peakInputTokens: peak,
    series: [...bins.values()],
    compactionPoints,
    recentGrowth: recentGrowth(analysis.modelCalls),
    ...(composition ? { latestComposition: composition } : {}),
  };
}

/**
 * The median change in reported input over the last ten calls since the latest compaction, or
 * null with fewer than two recorded values. The median keeps one large tool result from
 * dominating the rate.
 */
function recentGrowth(
  calls: { reportedPromptTokens: number | null; compactionBefore?: string | null }[],
): number | null {
  let start = 0;
  calls.forEach((call, index) => {
    if (call.compactionBefore) start = index;
  });
  const values = calls
    .slice(start)
    .map((call) => call.reportedPromptTokens)
    .filter((value): value is number => value !== null)
    .slice(-11);
  if (values.length < 2) return null;
  const changes = values
    .slice(1)
    .map((value, index) => value - values[index])
    .sort((left, right) => left - right);
  const middle = changes.length >> 1;
  return changes.length % 2
    ? changes[middle]
    : Math.round((changes[middle - 1] + changes[middle]) / 2);
}
