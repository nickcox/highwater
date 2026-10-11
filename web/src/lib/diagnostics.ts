export interface DiagnosticDescription {
  title: string;
  impact: string;
}

const TOKEN_DIAGNOSTICS: Readonly<Record<string, DiagnosticDescription>> = {
  providerUsageIncomplete: {
    title: 'Provider usage is incomplete',
    impact: 'Prompt reconciliation may be unavailable or partial.',
  },
  unsupportedTokenizer: {
    title: 'No supported tokenizer is available',
    impact: 'Token counts for this model cannot be calculated with a known tokenizer.',
  },
  heuristicTokenizer: {
    title: 'A character heuristic was used',
    impact: 'This is a rough estimate, not an exact tokenizer count.',
  },
  estimatedProviderSerialization: {
    title: 'Provider serialization was estimated',
    impact: 'The request format is approximated, so framing and prompt totals may differ.',
  },
  unsupportedImage: {
    title: 'Image content is not fully counted',
    impact: 'Text counts may omit image payload tokens.',
  },
  unsupportedPayload: {
    title: 'Some content could not be tokenized',
    impact: 'The affected payload is unavailable or unsupported by the selected method.',
  },
  unavailablePayload: {
    title: 'Some content is unavailable',
    impact: 'The affected payload is excluded from the token estimate.',
  },
  knownFramingOverheadAvailable: {
    title: 'Known request framing is included',
    impact: 'Supported message and tool framing overhead contributes to the calculated total.',
  },
  missingSystemPrompt: {
    title: 'No system prompt was found in the session',
    impact: 'The provider may add system instructions that are not represented here.',
  },
  missingToolDefinitions: {
    title: 'No tool definitions were found in the session',
    impact: 'Provider-side tool schemas may add prompt tokens not represented here.',
  },
  modelSwitchTransformation: {
    title: 'Content was transformed for a model switch',
    impact: 'The later request may serialize earlier content differently.',
  },
  negativeResidual: {
    title: 'Calculated context exceeds reported prompt usage',
    impact:
      'Differences in serialization or provider accounting may explain the negative residual.',
  },
  thinkingNotReadByModel: {
    title: 'Thinking from another model',
    impact:
      'The provider drops thinking it cannot read for this model, so it adds no tokens to this request.',
  },
  excludedFromContext: {
    title: 'Content was excluded from model context',
    impact: 'This item does not contribute to the request token estimate.',
  },
};

export function describeTokenDiagnostic(code: string): DiagnosticDescription | null {
  return TOKEN_DIAGNOSTICS[code] ?? null;
}
