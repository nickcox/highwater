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
        reconstruction: { status: 'partial' },
      }),
    ).toEqual({
      callCount: 3,
      compactionCount: 1,
      latestInputTokens: null,
      peakInputTokens: 45,
      series: [0, 45],
      partial: true,
    });
    expect(summariseAnalysis(analysis([]))).toMatchObject({
      callCount: 0,
      series: [],
      latestInputTokens: null,
      peakInputTokens: null,
      partial: false,
    });
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
