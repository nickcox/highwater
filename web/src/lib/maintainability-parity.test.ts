import { createHash, type Hash } from 'node:crypto';
import { indexTestAnalysis } from './testing/wire-analysis';
import { expect, it } from 'vitest';
import { projectCallComposition, projectCumulativeComposition } from './composition';
import { compositionScenario } from './testing/composition-scenarios';
import { sessionScenario, type SessionScenario } from './testing/session-scenarios';
import type { SessionAnalysis } from './types';
import { palettes } from './theme/palettes';

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
  longSession: '486238eadab5bc47daf489315963a726d9bbc455a541be0662c1d95f5203f618',
  partialGeometry: '47a1885a67e14f12619ffb7dee7478aa0dad38f3d0e960f1f6f134af544ca7cf',
  unavailableGeometry: '5fe55004ceeae764204e154c4fd0e464a24a8fba4416bce74732d2f496801b42',
  terminalCompaction: '87c76e0777dbd89821fcaeae3e5fd8e69714e872298b6611de862c59b7cf941a',
  terminalSummaryOnly: 'e297c916bf037c81fda6489036acbd50636095f471b275678ecfaf24346607c4',
  labelStress: 'f7be99d4ca2a915f589ede357131ce91088028739522464b2f1fda073a9ae199',
  multipleToolsMissingMetadata: '146bb0346a9b161ca6d84c1f31700dd64d4252a9fdee27181eaedf64c41011f3',
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
  // Compare the new stable slots in the original Dark-colour representation. This keeps the
  // pinned digests checking that assignment, index order and geometry have not changed.
  const legacyIndexed = Object.fromEntries(
    Object.entries(indexed).map(([key, value]) =>
      key === 'itemColorSlotById'
        ? [
            'itemColorById',
            new Map(
              [...indexed.itemColorSlotById].map(([id, slot]) => [id, palettes.dark.items[slot]]),
            ),
          ]
        : [key, value],
    ),
  );
  hash.update(serialize(legacyIndexed));
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
