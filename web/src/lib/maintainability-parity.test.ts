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

// Pinned digests of each scenario's indexed analysis and Composition projections, so a change
// that alters any of them fails here. When one changes on purpose, update it and say why in the
// commit message.
const scenarioDigests: Record<SessionScenario, string> = {
  empty: '4a62f4ecec6cf35274692dad6a11bd3ded90aa17c1c0acda63795260f52e451f',
  singleCall: '344b1c967153320275e9d59a24fb06c47adf24c84c916e3c4e2614b6db3a11fb',
  longSession: '89aa807c3243dfbbfb0cb410881cf9578cfd3441de5fdd45e6eebc8d16f2b31b',
  partialGeometry: 'f2e59b9cd75ce4c90ad3cb38189d2cc948338cb7e8ae09b7316d5bca4ccf8580',
  unavailableGeometry: 'ab8bce720bb986231644f963193f8eb3ec080c1f2d18c007c752e37f587145e7',
  terminalCompaction: '818be6fc750677356c461564a16153cb73214b21a59158742f5df4e9a183ca61',
  terminalSummaryOnly: '10ff0a3d9da1125693b4dbf77110c36b8cc6b9202beab5b66ae514aae393a384',
  labelStress: '61edcc4a4687f45c674940f37612771a9fc5a95466bcf8544e5ed8f421f52e66',
  multipleToolsMissingMetadata: '4557c27463e2815538e5c6bf0830b9cbc66296180f95b1ba05314330a5e4e552',
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
    expected: '720c426334debb0e7d4282435ca0d1606aea0050f6d2684d2d8c23d31b01a671',
  },
  {
    name: 'composition220Zero',
    input: compositionScenario(220, true),
    expected: '9b13b954d714526738b32bcc2393a77e54152e232f347a82499e5ceba37283fb',
  },
];

// Capture values and iteration order of every consumer-facing index, not just the envelope.
function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
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
  'matches the pinned digest of indexes and projections: $name',
  ({ input, expected }) => {
    const hash = createHash('sha256');
    updateParityHash(input, hash);
    expect(hash.digest('hex')).toBe(expected);
  },
);
