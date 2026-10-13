import { cleanup, render, screen } from '@testing-library/svelte';
import { indexTestAnalysis } from './testing/wire-analysis';
import { afterEach, describe, expect, it } from 'vitest';
import { assertReconstruction } from './reconstruction';
import { testAnalysis } from './context-river/test-data';
import SessionSummary from './components/SessionSummary.svelte';

afterEach(cleanup);

describe('source reconstruction coverage', () => {
  it('requires explicit qualifications for OpenCode and allows existing Pi output', () => {
    const analysis = testAnalysis();
    expect(() => assertReconstruction(analysis)).not.toThrow();
    analysis.session.source = 'opencode';
    expect(() => assertReconstruction(analysis)).toThrow(/coverage/);
    analysis.reconstruction = {
      status: 'partial',
      explanationCodes: ['missingHistoricalSystemPrompt', 'unknownOutputAccounting'],
    };
    expect(() => assertReconstruction(analysis)).not.toThrow();
  });
  it('requires a notice for Claude Code and accepts its limitation codes', () => {
    const analysis = testAnalysis();
    analysis.session.source = 'claude-code';
    expect(() => assertReconstruction(analysis)).toThrow(/coverage/);
    analysis.reconstruction = {
      status: 'partial',
      explanationCodes: [
        'missingHistoricalSystemPrompt',
        'missingHistoricalToolDefinitions',
        'unrecordedHarnessCalls',
        'unverifiedCompactionRetention',
        'unrenderedAttachments',
        'repairedCompactionLink',
      ],
    };
    expect(() => assertReconstruction(analysis)).not.toThrow();
  });
  it('rejects invalid, unknown, duplicated, and empty qualifications', () => {
    for (const codes of [
      [],
      ['arbitrary'],
      ['unknownOutputAccounting', 'unknownOutputAccounting'],
      ['__proto__'],
    ]) {
      const analysis = testAnalysis();
      analysis.reconstruction = { status: 'partial', explanationCodes: codes };
      expect(() => assertReconstruction(analysis)).toThrow(/coverage/);
    }
  });
  it('explains the reconstruction limits in the estimate-quality note, outside Session details', () => {
    const analysis = testAnalysis();
    analysis.reconstruction = {
      status: 'partial',
      explanationCodes: ['missingHistoricalSystemPrompt', 'unknownOutputAccounting'],
    };
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(analysis) },
    });
    const note = container.querySelector('#estimate-quality-note')!;
    expect(note).toHaveTextContent('Historical system instructions are not recorded completely.');
    expect(note).toHaveTextContent('Output/reasoning overlap is unverified');
    expect(note.closest('details')).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Reconstruction coverage' })).toBeNull();
  });
});
