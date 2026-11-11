import { costAssessmentOf, testAnalysis } from '../../src/lib/context-river/test-data';

export function economicsScenario(): ReturnType<typeof testAnalysis> {
  const analysis = testAnalysis();
  for (const call of analysis.modelCalls) {
    const input = call.index === 1 ? 750 : 1000;
    const cacheRead = call.index === 1 ? 250 : 0;
    const cacheWrite = 0;
    const promptTokens = input + cacheRead + cacheWrite;
    const piPromptCost = 0.0000000123 * call.index;
    call.provider = 'anthropic';
    call.api = 'anthropic-messages';
    call.usage = { ...call.usage, input, cacheRead, cacheWrite };
    call.cost = {
      input: piPromptCost,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: piPromptCost,
    };
    call.costAssessment = costAssessmentOf('recorded', piPromptCost);
    call.economics = {
      ...call.economics,
      policyId: 'anthropic-messages-cache-v1',
      usageCompleteness: 'complete',
      costCompleteness: 'complete',
      cacheWriteStatus: 'reported',
      promptTokens,
      cacheReadRatio: cacheRead / promptTokens,
      cacheWriteRatio: 0,
      freshRatio: input / promptTokens,
      piPromptCost,
      cacheRatioDiscontinuity: null,
      explanationCodes: [],
    };
  }
  analysis.modelCalls[3].model = 'different-model';
  analysis.modelCalls[1].economics.cacheRatioDiscontinuity = {
    previousCallIndex: 1,
    direction: 'drop',
    previousRatio: 0.25,
    currentRatio: 0,
    delta: 0.25,
    magnitude: 'notable',
    method: 'adjacent-cache-read-share-v1',
    previousPromptTokens: 1000,
    currentPromptTokens: 1000,
    compactionBefore: analysis.modelCalls[1].compactionBefore,
  };
  analysis.economics = {
    ...analysis.economics,
    supportedPolicyIds: ['anthropic-messages-cache-v1'],
    usageCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
    costCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
    cacheReadEligibleCalls: 4,
    cacheReadPromptTokens: 4000,
    cacheReadTokens: 250,
    cacheReadRatio: 0.0625,
    explanationCodes: [],
  };
  return analysis;
}
