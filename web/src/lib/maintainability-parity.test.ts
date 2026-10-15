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
  singleCall: '8396d765157552ad09f348f5903654d667236239ea1d8beb38cc0fcf38455ab1',
  longSession: '4472061e2c1818a477e3683b5df899836a62b8b62a9129cb8201f668189dbc3c',
  partialGeometry: 'b6367fe1b8dd8b56cac74c891208ab4a7a7b8a90c90dff6711d1eb823ff691db',
  unavailableGeometry: '2f59fa719389fd05b312f31772eb86eaf74f87568b0ce7c7f7b6d048d1412dac',
  terminalCompaction: 'd7488a3aee7b5ff139abfff2fa1ac1ec9b23b052dc760811c90c46bec146a692',
  terminalSummaryOnly: '10ff0a3d9da1125693b4dbf77110c36b8cc6b9202beab5b66ae514aae393a384',
  labelStress: 'fd165f697289d1c588eb8c07124450307a7bcd32757f7dca3556bd8b46869460',
  multipleToolsMissingMetadata: '0d1e13af4092305e3c9735b92380c82d4496226395a73445da4961e55cad2c2b',
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
    expected: 'e1f3a1abbe70ba8479879cd6cfcbd2b1f9146252caea9789897c62ed849b322d',
  },
  {
    name: 'composition220Zero',
    input: compositionScenario(220, true),
    expected: 'e1f56e85a85405c078cd617207c5977be00f536f4ad7c77dd9c5dd6ec9e3cbb1',
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
