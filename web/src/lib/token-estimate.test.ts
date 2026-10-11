import { describe, expect, it } from 'vitest';
import { claudeEstimateNote } from './token-estimate';

describe('Claude estimate notes', () => {
  it('names the reconstructed tokenizer generation', () => {
    expect(
      claudeEstimateNote({ tokenizerFamily: 'ctok-claude-v4.8', rule: 'claude-v4.8-ctok' }),
    ).toBe('Reconstructed tokenizer (ctok) for Claude Opus 4.8 and later');
    expect(claudeEstimateNote({ tokenizerFamily: 'ctok-claude-v3', rule: 'claude-v3-ctok' })).toBe(
      'Reconstructed tokenizer (ctok) for Claude 3 to Opus 4.6',
    );
  });

  it('says when an unmeasured model uses the newest generation', () => {
    expect(
      claudeEstimateNote({
        tokenizerFamily: 'ctok-claude-v4.8',
        rule: 'assumed-latest-claude-ctok',
      }),
    ).toMatch(/newest measured generation.*has not been measured/);
  });

  it('adds nothing for other profiles', () => {
    expect(claudeEstimateNote({ tokenizerFamily: 'o200k', rule: 'tiktoken-o200k-base' })).toBe(
      null,
    );
    expect(claudeEstimateNote(null)).toBe(null);
  });
});
