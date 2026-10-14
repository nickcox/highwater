import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from './testing/wire-analysis';
import { AnalysisValidationError } from './analysis';
import { testAnalysis } from './context-river/test-data';

function timed() {
  const analysis = testAnalysis();
  analysis.session.source = 'pi';
  const call = analysis.modelCalls[0];
  call.api = 'openai-codex-responses';
  call.timing = {
    startedAtMs: 1700000000000,
    recordedAtMs: 1700000002000,
    durationMs: 2000,
    effectiveOutputTokensPerSecond: 1,
    basis: 'pi-message-timestamps',
  };
  return analysis;
}

function copilotTimed() {
  const analysis = timed();
  analysis.session.source = 'vscode-copilot';
  analysis.reconstruction = { status: 'partial', explanationCodes: ['unrecordedHarnessCalls'] };
  const call = analysis.modelCalls[0];
  call.api = 'anthropic-messages';
  call.stopReason = 'stop';
  call.timing.basis = 'vscode-copilot-trace-spans';
  return analysis;
}

describe('VS Code Copilot trace span timing', () => {
  it('accepts a trace span duration whatever the stop reason', () => {
    const analysis = copilotTimed();
    analysis.modelCalls[0].stopReason = null;
    expect(indexTestAnalysis(analysis).analysis.modelCalls[0].timing.durationMs).toBe(2000);
  });
  it.each(['other-source', 'mismatch', 'wrong-rate'])('rejects %s', (kind) => {
    const analysis = copilotTimed();
    const call = analysis.modelCalls[0];
    if (kind === 'other-source') analysis.session.source = 'pi';
    if (kind === 'mismatch') call.timing.recordedAtMs! += 1;
    if (kind === 'wrong-rate') call.timing.effectiveOutputTokensPerSecond = 100;
    expect(() => indexTestAnalysis(analysis)).toThrow(AnalysisValidationError);
  });
});

describe('call timing boundary validation', () => {
  it('accepts usable and independently retained unknown-source instants without repairing data', () => {
    const analysis = timed();
    const before = JSON.stringify(analysis);
    expect(indexTestAnalysis(analysis).analysis.modelCalls[0].timing.durationMs).toBe(2000);
    expect(JSON.stringify(analysis)).toBe(before);
    analysis.modelCalls[0].api = 'custom-api';
    analysis.modelCalls[0].timing.durationMs = null;
    analysis.modelCalls[0].timing.effectiveOutputTokensPerSecond = null;
    analysis.modelCalls[0].timing.basis = null;
    expect(indexTestAnalysis(analysis).analysis.modelCalls[0].timing.startedAtMs).toBe(
      1700000000000,
    );
  });
  it.each([
    'unsafe',
    'missing-start',
    'nonpositive',
    'mismatch',
    'unsupported-api',
    'unsupported-source',
    'invalid-basis',
    'negative-rate',
    'nonfinite-rate',
    'wrong-rate',
    'aborted-rate',
    'missing-basis',
  ])('rejects %s timing', (kind) => {
    const analysis = timed();
    const call = analysis.modelCalls[0];
    if (kind === 'unsafe') call.timing.startedAtMs = Number.MAX_SAFE_INTEGER + 1;
    if (kind === 'missing-start') call.timing.startedAtMs = null;
    if (kind === 'nonpositive') call.timing.durationMs = 0;
    if (kind === 'mismatch') call.timing.recordedAtMs! += 1;
    if (kind === 'unsupported-api') call.api = 'custom-api';
    if (kind === 'unsupported-source') analysis.session.source = 'other';
    if (kind === 'invalid-basis') call.timing.basis = 'unknown' as never;
    if (kind === 'negative-rate') call.timing.effectiveOutputTokensPerSecond = -1;
    if (kind === 'nonfinite-rate') call.timing.effectiveOutputTokensPerSecond = Infinity;
    if (kind === 'wrong-rate') call.timing.effectiveOutputTokensPerSecond = 100;
    if (kind === 'aborted-rate') call.stopReason = 'aborted';
    if (kind === 'missing-basis') call.timing.basis = null;
    expect(() => indexTestAnalysis(analysis)).toThrow(AnalysisValidationError);
  });
  it('keeps unknown or unsuccessful rates unavailable and preserves genuine zero output', () => {
    const analysis = timed();
    const call = analysis.modelCalls[0];
    call.stopReason = 'error';
    call.timing.effectiveOutputTokensPerSecond = null;
    expect(() => indexTestAnalysis(analysis)).not.toThrow();
    call.stopReason = 'stop';
    call.usage = { ...call.usage, output: 0 };
    call.reportedCompletionTokens = 0;
    call.timing.effectiveOutputTokensPerSecond = 0;
    expect(() => indexTestAnalysis(analysis)).not.toThrow();
  });
});
