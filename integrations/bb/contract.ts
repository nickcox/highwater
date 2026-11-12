import { defineRpcContract } from '@get-bb/plugin-sdk';
import { z } from 'zod';

const binary = z.object({ binaryPath: z.string().max(4096).nullable() }).strict();
const etag = z.string().max(1024).nullable();
const sessionId = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
export const summarySchema = z
  .object({
    callCount: z.number().int().nonnegative(),
    compactionCount: z.number().int().nonnegative(),
    latestInputTokens: z.number().int().nonnegative().safe().nullable(),
    peakInputTokens: z.number().int().nonnegative().safe().nullable(),
    series: z.array(z.number().int().nonnegative().safe()).max(60),
    partial: z.boolean(),
  })
  .strict();
export type Summary = z.infer<typeof summarySchema>;
export const errorSchema = z
  .object({
    status: z.literal('error'),
    httpStatus: z.number().int().min(400).max(599),
    code: z.string(),
    message: z.string(),
  })
  .strict();
export type HostErrorResult = z.infer<typeof errorSchema>;
export const statusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('ready'), version: z.string() }).strict(),
  z.object({ state: z.literal('missing') }).strict(),
  z
    .object({ state: z.literal('unsupportedVersion'), version: z.string(), accepted: z.string() })
    .strict(),
  z.object({ state: z.literal('failed'), message: z.string() }).strict(),
]);
export type HostStatus = z.infer<typeof statusSchema>;
const analysisInput = binary.extend({ sessionId, ifNoneMatch: etag }).strict();
const notModified = z.object({ status: z.literal('notModified'), etag: z.string() }).strict();
const transferId = z.string().uuid();

export const threadIdSchema = z
  .string()
  .regex(/^thr_[A-Za-z0-9]+$/)
  .max(160);
export const threadRequestSchema = z
  .object({ threadId: threadIdSchema, ifNoneMatch: etag })
  .strict();
export const threadStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unknownThread') }).strict(),
  z.object({ state: z.literal('unsupportedAgent'), providerId: z.string() }).strict(),
  z.object({ state: z.literal('noEnvironment') }).strict(),
  z.object({ state: z.literal('noSession') }).strict(),
  z.object({ state: z.literal('binaryMissing') }).strict(),
  z
    .object({ state: z.literal('unsupportedVersion'), version: z.string(), accepted: z.string() })
    .strict(),
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
const usageSchema = z
  .object({
    usedTokens: z.number().nonnegative(),
    contextWindowTokens: z.number().nonnegative(),
  })
  .strict()
  .nullable();
export const rpcContract = defineRpcContract({
  threadSummary: {
    input: threadRequestSchema,
    output: z.union([
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
    ]),
  },
});

export const hostContract = defineRpcContract({
  status: { input: binary, output: statusSchema, experimental_retryable: true },
  findSession: {
    input: binary
      .extend({
        harness: z.enum(['pi', 'claude-code']),
        providerThreadId: z.string().min(1).max(256),
      })
      .strict(),
    output: z.union([
      z.object({ found: z.literal(true), sessionId }).strict(),
      z.object({ found: z.literal(false) }).strict(),
      errorSchema,
    ]),
    experimental_retryable: true,
  },
  openAnalysis: {
    input: analysisInput,
    output: z.union([
      notModified,
      errorSchema,
      z
        .object({
          status: z.literal('ok'),
          etag: z.string(),
          transferId,
          pieceCount: z.number().int().positive(),
          firstPiece: z.string().max(5_592_408),
        })
        .strict(),
    ]),
  },
  readAnalysisPiece: {
    input: z.object({ transferId, index: z.number().int().nonnegative() }).strict(),
    output: z.union([
      z.object({ piece: z.string().max(5_592_408) }).strict(),
      z.object({ expired: z.literal(true) }).strict(),
    ]),
    experimental_retryable: true,
  },
  closeAnalysisTransfer: {
    input: z.object({ transferId }).strict(),
    output: z.object({ closed: z.literal(true) }).strict(),
    experimental_retryable: true,
  },
  summary: {
    input: analysisInput,
    output: z.union([
      notModified,
      errorSchema,
      z.object({ status: z.literal('ok'), etag: z.string(), summary: summarySchema }).strict(),
    ]),
    experimental_retryable: true,
  },
});
