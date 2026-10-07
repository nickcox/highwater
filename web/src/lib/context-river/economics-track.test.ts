import { describe, expect, it } from 'vitest';
import copilotExport from '../../../../fixtures/analysis/copilot-economics.json';
import { testAnalysis } from './test-data';
import {
  projectCachePresentation,
  projectCacheTrack,
  projectCostTrack,
  hasNumericCacheData,
} from './economics-track';
import type { SessionAnalysis } from '../types';

function cacheCall(
  analysis: SessionAnalysis,
  index: number,
  policyId: string,
  input: number,
  cacheRead: number,
  cacheWrite: number | null,
  promptTokens: number,
): void {
  const call = analysis.modelCalls[index - 1];
  call.economics = {
    policyId,
    usageCompleteness:
      cacheWrite === null && policyId === 'anthropic-messages-cache-v1' ? 'partial' : 'complete',
    costCompleteness: 'missing',
    cacheWriteStatus:
      policyId === 'anthropic-messages-cache-v1'
        ? 'reported'
        : policyId === 'openai-completions-cache-v1'
          ? 'notReported'
          : 'notRetainedByPi',
    promptTokens:
      cacheWrite === null && policyId === 'anthropic-messages-cache-v1' ? null : promptTokens,
    cacheReadRatio: promptTokens > 0 ? cacheRead / promptTokens : null,
    cacheWriteRatio:
      policyId === 'anthropic-messages-cache-v1' && promptTokens > 0 && cacheWrite !== null
        ? cacheWrite / promptTokens
        : null,
    freshRatio:
      policyId !== 'openai-responses-cache-read-v1' && promptTokens > 0
        ? input / promptTokens
        : null,
    piPromptCost: null,
    cacheRatioDiscontinuity: null,
    explanationCodes: [],
  };
  call.usage = { ...call.usage, input, cacheRead, cacheWrite };
}

describe('economics track projections', () => {
  it('projects audited Copilot buckets and distinguishes zero, partial and missing calls', () => {
    const track = projectCacheTrack(copilotExport as SessionAnalysis);
    expect(track.points[1].status).toBe('complete');
    expect(track.points[1].segments.map((s) => [s.kind, s.value])).toEqual([
      ['cacheRead', 0],
      ['cacheWrite', 55482],
      ['fresh', 3],
    ]);
    expect(track.points[2].segments.map((s) => [s.kind, s.value])).toEqual([
      ['cacheRead', 55482],
      ['cacheWrite', 408],
      ['fresh', 3],
    ]);
    expect(track.points.slice(3).map((p) => p.status)).toEqual([
      'zero',
      'partial',
      'missing',
      'unsupported',
    ]);
  });
  it('projects only complete audited cache buckets and preserves explicit zero', () => {
    const analysis = testAnalysis();
    cacheCall(analysis, 1, 'anthropic-messages-cache-v1', 10, 20, 30, 60);
    cacheCall(analysis, 2, 'anthropic-messages-cache-v1', 0, 0, 0, 0);
    cacheCall(analysis, 3, 'openai-responses-cache-read-v1', 900, 100, 0, 1000);
    cacheCall(analysis, 4, 'anthropic-messages-cache-v1', 10, 0, null, 10);
    analysis.modelCalls.push({
      ...analysis.modelCalls[3],
      index: 5,
      economics: {
        ...analysis.modelCalls[3].economics,
        policyId: null,
        usageCompleteness: 'unsupported',
      },
    });

    const projection = projectCacheTrack(analysis);
    expect(projection.maximum).toBe(1000);
    expect(projection.points[0]).toMatchObject({ status: 'complete', promptTokens: 60 });
    expect(projection.points[0].segments.map(({ kind, value }) => [kind, value])).toEqual([
      ['cacheRead', 20],
      ['cacheWrite', 30],
      ['fresh', 10],
    ]);
    expect(projection.points[1]).toMatchObject({ status: 'zero', promptTokens: 0 });
    expect(projection.points[2].segments.map(({ kind, value }) => [kind, value])).toEqual([
      ['cacheRead', 100],
      ['nonRead', 900],
    ]);
    expect(projection.points[2].note).toContain('may include writes');
    expect(projection.points[3]).toMatchObject({ status: 'partial', segments: [] });
    expect(projection.points[4]).toMatchObject({ status: 'unsupported', segments: [] });
    expect(hasNumericCacheData(analysis)).toBe(true);
  });

  it('labels the audited Chat Completions input as uncached without inventing writes', () => {
    const analysis = testAnalysis();
    cacheCall(analysis, 1, 'openai-completions-cache-v1', 900, 100, 0, 1000);

    const point = projectCacheTrack(analysis).points[0];
    expect(point.segments.map(({ kind, label, value }) => [kind, label, value])).toEqual([
      ['cacheRead', 'Cache read', 100],
      ['uncached', 'Uncached input', 900],
    ]);
    expect(point.note).toContain('does not report a separate cache-write bucket');
  });

  it('exposes policy-aware categories and weighted per-call shares without inventing splits', () => {
    const analysis = testAnalysis();
    cacheCall(analysis, 1, 'anthropic-messages-cache-v1', 10, 20, 30, 60);
    cacheCall(analysis, 2, 'openai-completions-cache-v1', 90, 10, 0, 100);
    cacheCall(analysis, 3, 'openai-responses-cache-read-v1', 90, 10, 0, 100);

    const projection = projectCacheTrack(analysis);
    expect(projection.points[0].shareStatus).toBe('complete');
    expect(
      projection.points[0].shareSegments.reduce((sum, segment) => sum + segment.percentage, 0),
    ).toBeCloseTo(100);
    expect(projection.presentation.mixedPolicy).toBe(true);
    expect(projection.presentation.categories.map((category) => category.kind)).toEqual([
      'cacheRead',
      'cacheWrite',
      'fresh',
      'uncached',
      'nonRead',
    ]);
    expect(projection.presentation.notes.join(' ')).toContain('write/fresh split');
    expect(
      projection.presentation.categories.find((category) => category.kind === 'cacheWrite')
        ?.availability,
    ).toBe('available');
  });

  it('keeps zero prompt denominators explicit and distinguishes unavailable policy data', () => {
    const analysis = testAnalysis();
    cacheCall(analysis, 1, 'anthropic-messages-cache-v1', 0, 0, 0, 0);
    const projection = projectCacheTrack(analysis);
    expect(projection.points[0]).toMatchObject({
      status: 'zero',
      shareStatus: 'zeroPrompt',
      shareDenominator: 0,
    });
    expect(projection.points[0].shareSegments).toEqual([]);
    expect(projectCachePresentation(testAnalysis()).categories).toEqual([]);
  });

  it('keeps known zero, partial, and missing Pi cost totals distinct', () => {
    const analysis = testAnalysis();
    analysis.modelCalls[0].cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
    analysis.modelCalls[1].cost = {
      input: 0.0000000123,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0.0000000123,
    };
    analysis.modelCalls[2].cost = {
      input: 0.001,
      output: null,
      cacheRead: null,
      cacheWrite: null,
      total: null,
    };
    analysis.modelCalls[3].cost = null;

    const projection = projectCostTrack(analysis);
    expect(projection.maximum).toBe(0.0000000123);
    expect(projection.points.map(({ status }) => status)).toEqual([
      'zero',
      'known',
      'partial',
      'missing',
    ]);
    expect(projection.points[1].total).toBe(0.0000000123);
  });
});
