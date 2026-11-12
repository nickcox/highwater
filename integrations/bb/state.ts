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
