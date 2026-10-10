import { createHash, type Hash } from 'node:crypto';
import { indexTestAnalysis } from './testing/wire-analysis';
import { expect, it } from 'vitest';
import { projectCallComposition, projectCumulativeComposition } from './composition';
import { compositionScenario } from './testing/composition-scenarios';
import { sessionScenario, type SessionScenario } from './testing/session-scenarios';
import type { SessionAnalysis } from './types';

const scenarios: SessionScenario[] = [
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

// Derived from pre-extraction commit 8a0acb2, not regenerated from refactored outputs.
const scenarioDigests: Record<SessionScenario, string> = {
  empty: '35cb7d585d8a81837f27d49879146f670d7bb825120c21cf0705ce623441e8ae',
  singleCall: '73cd7feb3c55eb945cfefebd65437fdf28cc3d01bbf20bcd68d0c7437d93178e',
  longSession: '2d62c14b97c92b290c6747a00da6cfa6c40b6ec7ad6c4889f6953e121d008c4c',
  partialGeometry: 'ad192271ea04631434032a0f910bf23e39922aea0f79c0b2e57ae6407ca2fa69',
  unavailableGeometry: '76c307d6734a23896a4051c76dfc2dbfeae05efe8b3674fc1f60bad1438c977d',
  terminalCompaction: 'b1a2775c7afa0236dd7c67ced8ff0992a337a46404c4f0d60cc4df610117e478',
  terminalSummaryOnly: 'e075fc3a778eea27f26fa196dceff8fffad88cef60ed88fa54ea8de4e07bc6bc',
  labelStress: '5cc44ef31ee3f0e7804988c3c8840cba270e3a217b8f5a4fc5ba748be3d53741',
  multipleToolsMissingMetadata: '33a7eb9e26ea86a2d2c80bf03fd02a9c1f2a74ff815622b877da9d185779000b',
};

const fixtures = [
  ...scenarios.map((name) => ({
    name,
    input: sessionScenario(name),
    expected: scenarioDigests[name],
  })),
  {
    name: 'composition220',
    input: compositionScenario(220),
    expected: '8d77d73e487c890691f67751ccf91dab027f899e391bfdf6977010bb500f273d',
  },
  {
    name: 'composition220Zero',
    input: compositionScenario(220, true),
    expected: '4e7395b5bbffed9a0e658ffebbf9ac598f1dee58650f1866f7d51863cd0493a2',
  },
];

// Capture values and iteration order of every consumer-facing index, not just the envelope.
function serialize(value: unknown): string {
  return JSON.stringify(value, (key, entry) => {
    // Keep the original analytical/index/projection goldens: timing, the
    // schema-10 recorded-counter additions and the session subtotal coverage
    // have their own live contract tests.
    if (
      [
        'timing',
        'recordedOutput',
        'outputReasoningRelationship',
        'placeholder',
        'reportedCostCoverage',
        'reportedUsageCoverage',
      ].includes(key)
    )
      return undefined;
    if (key === 'schemaVersion') return 7;
    if (entry instanceof Map) return { map: [...entry] };
    if (entry instanceof Set) return { set: [...entry] };
    return entry;
  });
}

function updateParityHash(input: SessionAnalysis, hash: Hash): void {
  const indexed = indexTestAnalysis(input);
  hash.update(serialize(indexed));
  hash.update(serialize(projectCumulativeComposition(indexed, null)));
  for (const call of indexed.analysis.modelCalls) {
    hash.update(serialize(projectCallComposition(indexed, call.index)));
    hash.update(serialize(projectCumulativeComposition(indexed, call.index)));
  }
}

it.each(fixtures)(
  'preserves pre-extraction indexes and projections: $name',
  ({ input, expected }) => {
    const hash = createHash('sha256');
    updateParityHash(input, hash);
    expect(hash.digest('hex')).toBe(expected);
  },
);

it('preserves the original aggregate scope/coverage digest and fixture order', () => {
  const hash = createHash('sha256');
  for (const { input } of fixtures) updateParityHash(input, hash);
  expect(hash.digest('hex')).toBe(
    '5e46420e868175dcd6475aae3607140b5ce627f4ef666c4259d092d1bc0325a1',
  );
});
