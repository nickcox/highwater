import type { ModelCall } from './types';
import { AnalysisValidationError } from './analysis-validation';

const PI_TIMING_APIS = new Set([
  'openai-codex-responses',
  'openai-responses',
  'openai-completions',
  'anthropic-messages',
  'google-generative-ai',
  'google-vertex',
  'azure-openai-responses',
  'bedrock-converse-stream',
  'pi-messages',
]);

export function assertCallTiming(call: ModelCall, piSource: boolean): void {
  const timing = call.timing;
  const fail = () => {
    throw new AnalysisValidationError(`Call ${call.index} has invalid response timing`);
  };
  if (!timing || typeof timing !== 'object') return fail();
  for (const instant of [timing.startedAtMs, timing.recordedAtMs]) {
    if (
      instant !== null &&
      (!Number.isSafeInteger(instant) || !Number.isFinite(new Date(instant).getTime()))
    )
      fail();
  }
  const { durationMs, effectiveOutputTokensPerSecond: rate, basis } = timing;
  if (durationMs === null) {
    if (rate !== null || basis !== null) fail();
    return;
  }
  if (
    !Number.isSafeInteger(durationMs) ||
    durationMs <= 0 ||
    basis !== 'pi-message-timestamps' ||
    !piSource ||
    !PI_TIMING_APIS.has(call.api ?? '') ||
    !['stop', 'toolUse', 'length', 'error', 'aborted'].includes(call.stopReason ?? '') ||
    timing.startedAtMs === null ||
    timing.recordedAtMs === null ||
    timing.recordedAtMs - timing.startedAtMs !== durationMs
  )
    fail();
  const complete = ['stop', 'toolUse', 'length'].includes(call.stopReason ?? '');
  const output = call.usage.output;
  if (output !== null && (!Number.isSafeInteger(output) || output < 0)) fail();
  const expected = complete && output !== null ? (output * 1000) / durationMs : null;
  if (expected === null) {
    if (rate !== null) fail();
  } else if (
    rate === null ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    Math.abs(rate - expected) > Math.max(1, Math.abs(expected)) * 1e-9
  )
    fail();
}
