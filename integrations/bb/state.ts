import { z } from 'zod';

// Shared validation without the server-only RPC registration helper.
export const threadIdSchema = z
  .string()
  .regex(/^thr_[A-Za-z0-9]+$/)
  .max(160);
export const threadStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unknownThread') }).strict(),
  z.object({ state: z.literal('unsupportedAgent'), providerId: z.string() }).strict(),
  z.object({ state: z.literal('noEnvironment') }).strict(),
  z.object({ state: z.literal('noSession') }).strict(),
  z.object({ state: z.literal('binaryMissing') }).strict(),
  z.object({ state: z.literal('startFailed'), message: z.string() }).strict(),
  z.object({ state: z.literal('sessionNotFound'), providerThreadId: z.string() }).strict(),
  z
    .object({
      state: z.literal('error'),
      httpStatus: z.number().int().min(400).max(599),
      code: z.string(),
      message: z.string(),
    })
    .strict(),
]);
export type ThreadState = z.infer<typeof threadStateSchema>;

export const summarySchema = z
  .object({
    callCount: z.number().int().nonnegative(),
    compactionCount: z.number().int().nonnegative(),
    latestInputTokens: z.number().int().nonnegative().safe().nullable(),
    peakInputTokens: z.number().int().nonnegative().safe().nullable(),
    series: z.array(z.number().int().nonnegative().safe()).max(60),
    /** Positions in `series` whose calls include the first call after a compaction. */
    compactionPoints: z.array(z.number().int().nonnegative()).max(60),
    /** Median change in reported input per call, over recent calls since the last compaction. */
    recentGrowth: z.number().int().safe().nullable(),
  })
  .strict();
export type Summary = z.infer<typeof summarySchema>;
const usageSchema = z
  .object({ usedTokens: z.number().nonnegative(), contextWindowTokens: z.number().nonnegative() })
  .strict()
  .nullable();
export const threadRequestSchema = z
  .object({ threadId: threadIdSchema, ifNoneMatch: z.string().max(1024).nullable() })
  .strict();
export const threadSummaryResultSchema = z.union([
  z
    .object({
      state: z.literal('ok'),
      etag: z.string(),
      summary: summarySchema,
      usage: usageSchema,
    })
    .strict(),
  z.object({ state: z.literal('notModified'), etag: z.string(), usage: usageSchema }).strict(),
  threadStateSchema,
]);
export type ThreadSummaryResult = z.infer<typeof threadSummaryResultSchema>;
export type ThreadSummaryData = Extract<ThreadSummaryResult, { state: 'ok' }>;
