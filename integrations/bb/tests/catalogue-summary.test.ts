import { describe, expect, it, vi } from 'vitest';
import { SessionCatalogue, matchSession } from '../host/catalogue';
import { summariseAnalysis } from '../host/summary';
import { analysis, deferred, response, testServer } from './helpers';

const entries = [
  {
    id: 'pi-old',
    harness: 'pi',
    fileName: 'name_with_spaces.jsonl',
    parentReference: null,
    modifiedAt: '2026-01-01',
  },
  {
    id: 'pi-new',
    harness: 'pi',
    fileName: 'name_with_spaces.jsonl',
    parentReference: null,
    modifiedAt: '2026-02-01',
  },
  {
    id: 'claude-child',
    harness: 'claude-code',
    fileName: 'child.jsonl',
    parentReference: 'parent',
  },
  { id: 'claude-main', harness: 'claude-code', fileName: 'main.jsonl', parentReference: null },
];
describe('catalogue', () => {
  it('matches harness and sanitised filename, excludes children and chooses the newest duplicate', () => {
    expect(matchSession(entries, 'pi', 'name with spaces')).toBe('pi-new');
    expect(matchSession(entries, 'claude-code', 'main')).toBe('claude-main');
    expect(matchSession(entries, 'claude-code', 'child')).toBeNull();
    expect(matchSession(entries, 'pi', 'main')).toBeNull();
    expect(matchSession(entries, 'pi', '../main')).toBeNull();
  });
  it('preserves sub-millisecond timestamp ordering for duplicate session filenames', () => {
    const duplicates = [
      {
        id: 'a-older',
        harness: 'pi',
        fileName: 'same.jsonl',
        modifiedAt: '2026-01-01T00:00:00.123456001Z',
      },
      {
        id: 'z-newer',
        harness: 'pi',
        fileName: 'same.jsonl',
        modifiedAt: '2026-01-01T00:00:00.123456999Z',
      },
    ];
    expect(matchSession(duplicates, 'pi', 'same')).toBe('z-newer');
    expect(matchSession([{ ...duplicates[1], parentReference: '' }], 'pi', 'same')).toBeNull();
  });

  it('shares concurrent checks, revalidates and resets its ETag after restart', async () => {
    const pending = deferred<Response>();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(response({ sessions: entries }, '"v2"'));
    const catalogue = new SessionCatalogue(1000, fetcher);
    const one = catalogue.list(testServer());
    const two = catalogue.list(testServer());
    pending.resolve(response({ sessions: entries }));
    expect(await one).toEqual(await two);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await catalogue.list(testServer());
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ 'If-None-Match': '"v1"' });
    await catalogue.list(testServer(2));
    expect(fetcher.mock.calls[2][1]?.headers).toEqual({});
  });
  it('rejects unverified catalogues and unexpected 304 responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(response({ sessions: [{ id: '../bad' }] }));
    const catalogue = new SessionCatalogue(1000, fetcher);
    await expect(catalogue.list(testServer())).rejects.toMatchObject({ code: 'catalogueInvalid' });
    await expect(catalogue.list(testServer())).rejects.toMatchObject({ code: 'catalogueInvalid' });
  });
});
describe('summary', () => {
  it('uses reported tokens, preserves missing latest values and includes coverage', () => {
    expect(
      summariseAnalysis({
        ...analysis([0, '45', null]),
        compactions: [{}],
      }),
    ).toEqual({
      callCount: 3,
      compactionCount: 1,
      latestInputTokens: null,
      peakInputTokens: 45,
      series: [0, 45],
      compactionPoints: [],
      recentGrowth: 45,
    });
    expect(summariseAnalysis(analysis([]))).toMatchObject({
      callCount: 0,
      series: [],
      latestInputTokens: null,
      peakInputTokens: null,
      compactionPoints: [],
      recentGrowth: null,
    });
  });
  it('marks compactions in the series and measures growth since the latest one', () => {
    const tokens = [100, 300, 600, 900, 200, 260, 380, 400, 700];
    const input = analysis(tokens);
    (input.modelCalls[4] as { compactionBefore?: string }).compactionBefore = 'c1';
    const summary = summariseAnalysis({ ...input, compactions: [{}] });
    expect(summary.compactionPoints).toEqual([4]);
    // Changes since the compaction: +60, +120, +20, +300; the median is (60 + 120) / 2.
    expect(summary.recentGrowth).toBe(90);
  });
  it('uses only the latest call’s distinct items and matching token estimates', () => {
    const estimate = (tokens: number | null, coverage = 'complete', profileId = 'latest') => ({
      tokens,
      coverage,
      profileId,
    });
    const summary = summariseAnalysis({
      ...analysis([200, null]),
      modelCalls: [
        {
          reportedPromptTokens: 200,
          contextItemIndexes: [0, 4],
          tokenizationProfileId: 'earlier',
        },
        {
          reportedPromptTokens: null,
          contextItemIndexes: [3, 1, 5, 2, 6, 0, 1],
          tokenizationProfileId: 'latest',
          compactionBefore: 'c1',
        },
      ],
      contextItems: [
        { kind: 'system', tokenEstimates: [estimate(10), estimate(200, 'complete', 'earlier')] },
        { kind: 'toolResult', tokenEstimates: [estimate(20, 'partial')] },
        { kind: 'toolResult', tokenEstimates: [estimate(30)] },
        {
          kind: 'userMessage',
          tokenEstimates: [estimate(null), estimate(5, 'complete', 'earlier')],
        },
        { kind: 'toolDefinition', tokenEstimates: [estimate(100)] },
        { kind: 'customMessage', tokenEstimates: [estimate(40)] },
        { kind: 'toolDefinition', tokenEstimates: [estimate(80)] },
      ],
    });
    expect(summary.latestComposition).toEqual({
      segments: [
        { kind: 'system', tokens: 10 },
        { kind: 'toolDefinition', tokens: 80 },
        { kind: 'customMessage', tokens: 40 },
        { kind: 'toolResult', tokens: 50 },
      ],
      incomplete: true,
    });
  });
  it('omits composition when the latest call has no usable estimates', () => {
    expect(
      summariseAnalysis({
        ...analysis([100, 200]),
        modelCalls: [
          { reportedPromptTokens: 100, contextItemIndexes: [0], tokenizationProfileId: 'complete' },
          { reportedPromptTokens: 200, contextItemIndexes: [0], tokenizationProfileId: 'missing' },
        ],
        contextItems: [
          {
            kind: 'system',
            tokenEstimates: [{ tokens: 100, coverage: 'complete', profileId: 'complete' }],
          },
        ],
      }).latestComposition,
    ).toBeUndefined();
  });
  it('uses at most the last ten changes for growth', () => {
    const tokens = [...Array.from({ length: 20 }, (_, i) => i * 1000), 19500];
    expect(summariseAnalysis(analysis(tokens)).recentGrowth).toBe(1000);
  });
  it('keeps the highest reported value per call group in a series of at most 60 points', () => {
    const tokens = Array.from({ length: 600 }, (_, i) => (i === 149 ? 9000 : i));
    const summary = summariseAnalysis(analysis(tokens));
    expect(summary.series).toHaveLength(60);
    expect(summary.series).toContain(9000);
    expect(summary.peakInputTokens).toBe(9000);
    expect(summary.latestInputTokens).toBe(599);
  });
  it('rejects invalid schemas and unsafe or negative counts rather than estimating them', () => {
    for (const input of [
      { ...analysis(), schemaVersion: 2 },
      analysis([-1]),
      analysis(['9007199254740992']),
      { modelCalls: [] },
    ]) {
      expect(() => summariseAnalysis(input)).toThrow('unsupported or invalid analysis');
    }
  });
});
