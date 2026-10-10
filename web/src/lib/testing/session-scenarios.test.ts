import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from './wire-analysis';
import {
  liveAppendReplacementScenario,
  sessionScenario,
  type SessionScenario,
} from './session-scenarios';

const scenarioNames: SessionScenario[] = [
  'empty',
  'singleCall',
  'longSession',
  'partialGeometry',
  'unavailableGeometry',
  'terminalCompaction',
  'terminalSummaryOnly',
  'labelStress',
  'multipleToolsMissingMetadata',
];

describe('sanitized session scenario fixtures', () => {
  it.each(scenarioNames)('%s is a valid normalized analysis', (name) => {
    expect(() => indexTestAnalysis(sessionScenario(name))).not.toThrow();
  });

  it('provides a deterministic long session and honest empty and single-call cases', () => {
    expect(sessionScenario('empty').modelCalls).toHaveLength(0);
    expect(sessionScenario('singleCall').modelCalls).toHaveLength(1);
    expect(sessionScenario('terminalSummaryOnly').modelCalls).toHaveLength(0);
    expect(sessionScenario('terminalSummaryOnly').contextItems[0].presence).toEqual([]);
    expect(sessionScenario('longSession').modelCalls).toHaveLength(160);
    expect(sessionScenario('longSession').modelCalls).toEqual(
      sessionScenario('longSession').modelCalls,
    );
  });

  it('keeps stable identities and labels through an append plus same-session replacement', () => {
    const { initial, replacement } = liveAppendReplacementScenario();
    const before = indexTestAnalysis(initial);
    const after = indexTestAnalysis(replacement);

    expect(after.analysis.modelCalls).toHaveLength(before.analysis.modelCalls.length + 1);
    expect(after.analysis.modelCalls[1].model).toBe('replaced-model');
    expect(after.analysis.contextItems.map((item) => [item.id, item.label])).toEqual(
      before.analysis.contextItems.map((item) => [item.id, item.label]),
    );
  });
});
