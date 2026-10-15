import type { TokenizationMethod, TokenizationProfileSummary } from './types';

const CLAUDE_GENERATIONS: Record<string, string> = {
  'ctok-claude-v3': 'Claude 3 to Opus 4.6',
  'ctok-claude-v4.7': 'Claude Opus 4.7',
  'ctok-claude-v4.8': 'Claude Opus 4.8 and later',
};

/** How a Claude estimate was made, or null for other profiles. Anthropic publishes no
 * tokenizer, so these counts come from ctok's reconstruction of each tokenizer generation. */
export function claudeEstimateNote(
  profile: Pick<TokenizationProfileSummary, 'tokenizerFamily' | 'rule'> | null | undefined,
): string | null {
  const generation = profile ? CLAUDE_GENERATIONS[profile.tokenizerFamily] : undefined;
  if (!profile || !generation) return null;
  if (profile.rule === 'assumed-latest-claude-ctok') {
    return `Reconstructed tokenizer (ctok) for the newest measured generation, ${generation}; this model has not been measured`;
  }
  return `Reconstructed tokenizer (ctok) for ${generation}`;
}

const METHOD_LABELS: Readonly<Partial<Record<TokenizationMethod, string>>> = {
  modelTokenizer: 'Model tokenizer',
  apiSerializationEstimate: 'Estimated API serialization',
  characterHeuristic: 'Character heuristic',
  reportedUsage: 'From reported usage',
};

/** How a token estimate was made. `unavailable` is shown when the method is missing or unknown. */
export function estimateMethodLabel(
  method: string | null | undefined,
  unavailable = 'Unavailable estimate method',
): string {
  return (method && METHOD_LABELS[method as TokenizationMethod]) || unavailable;
}
