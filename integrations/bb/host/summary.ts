import { z } from 'zod';
import type { Summary } from '../contract';
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
  modelCalls: z.array(z.object({ reportedPromptTokens: tokens })),
  compactions: z.array(z.unknown()),
  reconstruction: z.unknown().optional(),
});
export function summariseAnalysis(input: unknown): Summary {
  const parsed = analysisSchema.safeParse(input);
  if (!parsed.success)
    throw new HostFailure(
      502,
      'analysisInvalid',
      'Highwater returned an unsupported or invalid analysis for the context summary.',
    );
  const analysis = parsed.data;
  const bins = new Map<number, number>();
  let peak: number | null = null;
  analysis.modelCalls.forEach((call, index) => {
    const value = call.reportedPromptTokens;
    if (value === null) return;
    peak = peak === null ? value : Math.max(peak, value);
    const bin = Math.floor(
      (index * Math.min(60, analysis.modelCalls.length)) / analysis.modelCalls.length,
    );
    bins.set(bin, Math.max(bins.get(bin) ?? 0, value));
  });
  return {
    callCount: analysis.modelCalls.length,
    compactionCount: analysis.compactions.length,
    latestInputTokens: analysis.modelCalls.at(-1)?.reportedPromptTokens ?? null,
    peakInputTokens: peak,
    series: [...bins.values()],
    partial: analysis.reconstruction !== undefined && analysis.reconstruction !== null,
  };
}
