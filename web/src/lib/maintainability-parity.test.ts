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
  singleCall: '06cff4d4a8304ff42c79dce64d417135c9fc5b03bd3c43ca8b53096a75888dde',
  longSession: '1b4a4b87e021d4fd3ebd1fc95ccebe2d391ec43d592a769f3c7715360f91ae7b',
  partialGeometry: 'a8ccaf6d4299abe5d3476ba9e3ecdb796a00efc72597b59f17f2462d174bf677',
  unavailableGeometry: '1888de60d22550e59c73b27923d0a2b592294064e7e71e88128be9c27a09a0ec',
  terminalCompaction: '612a574023db2b1886cde11540dc2d9223359dc10552cd4569b739238eae12d4',
  terminalSummaryOnly: 'e297c916bf037c81fda6489036acbd50636095f471b275678ecfaf24346607c4',
  labelStress: '58af9b9c28bc6fab7055c9b3eb49cd1c5b36193b8f8ab2275a6fc9da68ab711a',
  multipleToolsMissingMetadata: 'de5eade0b404593daa3a7d2ed7f0491fe9c633f315c1bbaca972e75f4795e15b',
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
    expected: 'e00aac42e6d6670446e994a95c673083bbd8fd0313687feb095e48e3b8e188e1',
  },
  {
    name: 'composition220Zero',
    input: compositionScenario(220, true),
    expected: '6aa9d90b130e1460a8f8676274637936a3770c28e4577753cd60e2511706ce49',
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
