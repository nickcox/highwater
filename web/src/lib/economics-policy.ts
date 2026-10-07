// Metadata for the existing audited backend policies, not a frontend derivation engine.
export type EconomicsCacheCategory = 'cacheRead' | 'cacheWrite' | 'fresh' | 'uncached' | 'nonRead';
export const ECONOMICS_POLICIES = {
  'anthropic-messages-cache-v1': {
    provider: 'anthropic',
    api: 'anthropic-messages',
    cacheWriteStatus: 'reported',
    hasFreshRatio: true,
    hasWriteRatio: true,
    categories: ['cacheRead', 'cacheWrite', 'fresh'],
  },
  'github-copilot-responses-cache-v1': {
    provider: 'github-copilot',
    api: 'openai-responses',
    cacheWriteStatus: 'reported',
    hasFreshRatio: true,
    hasWriteRatio: true,
    categories: ['cacheRead', 'cacheWrite', 'fresh'],
  },
  'openai-completions-cache-v1': {
    provider: 'openai',
    api: 'openai-completions',
    cacheWriteStatus: 'notReported',
    hasFreshRatio: true,
    hasWriteRatio: false,
    categories: ['cacheRead', 'uncached'],
  },
  'openai-responses-cache-read-v1': {
    provider: 'openai',
    api: 'openai-responses',
    cacheWriteStatus: 'notRetainedByPi',
    hasFreshRatio: false,
    hasWriteRatio: false,
    categories: ['cacheRead', 'nonRead'],
  },
  'openai-codex-responses-cache-read-v1': {
    provider: 'openai-codex',
    api: 'openai-codex-responses',
    cacheWriteStatus: 'notRetainedByPi',
    hasFreshRatio: false,
    hasWriteRatio: false,
    categories: ['cacheRead', 'nonRead'],
  },
} as const;
