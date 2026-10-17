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
  empty: '9bd126e3e7853666ffa00d0a8d6b0af45b72a22766d39a221e55544c70f262c8',
  singleCall: '3b5e8385304f99dff9b6323f4a9bdbd78cdfd56c611949e23f846650d741779a',
  longSession: '7f190bf52ceb12d5263dfd7f850dbe53fda7b7d45fc76fe93399ff3b18ec59e3',
  partialGeometry: '631d6dc36100694092b8d4105e7bb903dacd0b2e1825a5746e98b3f73e75dc8c',
  unavailableGeometry: '1e1efd927e61de9ac05fef2d827ef70725396b83b654a5e4131e10378c7bb5cd',
  terminalCompaction: '91de53bcd50db1e8b85678e8db1410fdad2c502f8be798d2929f91a6e0c16698',
  terminalSummaryOnly: '45131fbcbde19345cbadda8f09e3ba7825226b5773e88e436723e992eed3a130',
  labelStress: 'd510efa91210f647bf2a91ca6f0042050ed5bca584bc6abaa6179364351f3d56',
  multipleToolsMissingMetadata: '6c8af98b10c68711a838fdf4e69b72b2f2aa453d9fb50c68904d309289e88797',
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
    expected: '5ceb0161349d8d1d45db3811bdd685e403e034ca170f10adc4886cb7083d6274',
  },
  {
    name: 'composition220Zero',
    input: compositionScenario(220, true),
    expected: 'fe8e81dce345c7fe75146230de7d51e3d3c54baba7d1e3214c217a4cb602f640',
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
