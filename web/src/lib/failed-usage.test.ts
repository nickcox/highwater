import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import failedExport from '../../../fixtures/analysis/failed-usage.json';
import { indexAnalysis } from './analysis';
import type { WireSessionAnalysis } from './types';
import { recordedResponseMetrics } from './recorded-usage';
import { layoutCallColumns } from './context-river/layout';
import {
  inputComparisons,
  inputScaleColumns,
  layoutInputReferences,
} from './context-river/reported-input';
import CallDetails from './components/CallDetails.svelte';

const fixture = () => structuredClone(failedExport) as WireSessionAnalysis;
afterEach(cleanup);

describe('failed-attempt usage evidence', () => {
  it('accepts live Rust qualification, preserves attempts and distinguishes successful zero', () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const indexed = indexAnalysis(input);
    expect(indexed.analysis.modelCalls).toHaveLength(6);
    for (const call of indexed.analysis.modelCalls.slice(1, 3)) {
      expect(call.reportedPromptTokens).toBeNull();
      expect(call.reportedCompletionTokens).toBeNull();
      expect(call.reportedTotalTokens).toBeNull();
      expect(call.reportedUsageCompleteness).toBe('missing');
      expect(call.usage.placeholder?.totalTokens).toBe(0);
      expect(call.cost).toBeNull();
      expect(call.economics.cacheReadRatio).toBeNull();
      expect(call.economics.usageCompleteness).toBe('missing');
      expect(call.tokenAnalysis.calculatedVisibleTokens).toBeGreaterThan(0);
    }
    expect(indexed.analysis.modelCalls[4].usage.placeholder).toBeNull();
    expect(indexed.analysis.modelCalls[4].reportedPromptTokens).toBe(0);
    expect(indexed.analysis.modelCalls[4].usage.recordedOutput).toBe(0);
    expect(indexed.analysis.modelCalls[5].reportedPromptTokens).toBe(200);
    // Session subtotals keep recorded calls and count failed attempts separately.
    expect(indexed.analysis.session.reportedCostTotal).toBeCloseTo(0.0471, 10);
    expect(indexed.analysis.session.reportedCostCoverage).toEqual({
      recordedCalls: 4,
      failedAttemptCalls: 2,
      missingCalls: 0,
    });
    expect(indexed.analysis.session.reportedPromptTokens).toBe(450);
    expect(indexed.analysis.session.reportedUsageCoverage).toEqual({
      recordedCalls: 4,
      failedAttemptCalls: 2,
      missingCalls: 0,
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each([
    'missingEvidence',
    'nonzeroRaw',
    'unsafeRaw',
    'missingRaw',
    'unknownReason',
    'measuredInput',
    'measuredOutput',
    'measuredCost',
    'rawCost',
    'rawBreakdown',
  ])('rejects inconsistent or malformed evidence: %s', (mutation) => {
    const input = fixture();
    const call = input.modelCalls[1];
    const raw = call.usage.placeholder!;
    switch (mutation) {
      case 'missingEvidence':
        delete (call.usage as Partial<typeof call.usage>).placeholder;
        break;
      case 'nonzeroRaw':
        raw.input = 1;
        break;
      case 'unsafeRaw':
        raw.output = Number.MAX_SAFE_INTEGER + 1;
        break;
      case 'missingRaw':
        delete (raw as Partial<typeof raw>).totalTokens;
        break;
      case 'unknownReason':
        raw.reason = 'unknown' as typeof raw.reason;
        break;
      case 'measuredInput':
        call.usage.input = 0;
        break;
      case 'measuredOutput':
        call.usage.recordedOutput = 0;
        break;
      case 'measuredCost':
        call.cost = { input: null, output: null, cacheRead: null, cacheWrite: null, total: 0 };
        break;
      case 'rawCost':
        raw.cost!.total = 1;
        break;
      case 'rawBreakdown':
        raw.reasoning = undefined as unknown as number;
        break;
    }
    expect(() => indexAnalysis(input)).toThrow(/placeholder/);
  });

  it('breaks the reference at failed placeholders without shrinking known context or hiding measured zero', () => {
    const indexed = indexAnalysis(fixture());
    const options = {
      width: 960,
      height: 500,
      margin: { left: 42, right: 24, top: 36, bottom: 54 },
      minimumVisibleThickness: 1,
    };
    const columns = layoutCallColumns(indexed, options.width, options.margin);
    const before = JSON.stringify(columns);
    const comparisons = inputComparisons(indexed, columns);
    expect([...comparisons.keys()]).toEqual([1, 4, 5, 6]);
    expect(comparisons.get(5)?.reported).toBe(0);
    const scale = inputScaleColumns(columns, comparisons);
    expect(scale[1].totalDisplayWeight).toBe(columns[1].totalDisplayWeight);
    expect(scale[2].totalDisplayWeight).toBe(columns[2].totalDisplayWeight);
    expect(layoutInputReferences(columns, comparisons, options, 200)).toHaveLength(2);
    expect(JSON.stringify(columns)).toBe(before);
  });

  it.each(['pi', 'opencode', 'future-harness'])(
    'shows unavailable primary metrics and exact raw placeholders for %s',
    (source) => {
      const input = fixture();
      const indexed = indexAnalysis(input);
      indexed.analysis.session.source = source;
      const call = indexed.analysis.modelCalls[1];
      const { container } = render(CallDetails, { props: { indexed, call, pinned: true } });
      const primary = container.querySelector('.essential-metrics')!;
      const metrics = new Map(
        [...primary.querySelectorAll('dt')].map((node) => [
          node.textContent?.trim(),
          node.nextElementSibling?.textContent?.trim(),
        ]),
      );
      expect(metrics.get('Input')).toBe('Unavailable');
      expect(metrics.get('Recorded output')).toBe('Unavailable');
      expect(metrics.get('Provider usage')).toContain('Unavailable');
      expect(primary).not.toHaveTextContent('$0');
      const raw = container.querySelector('[aria-label="Raw recorded placeholders"]')!;
      expect(raw).toHaveTextContent(/Total tokens \(raw placeholder\)\s*0/);
      expect(raw).toHaveTextContent(/Total cost \(raw placeholder\).*0/);
      expect(container).toHaveTextContent('recorded zeros are placeholders, not measured usage');
      expect(recordedResponseMetrics(indexed.analysis.modelCalls[2].usage)).toEqual([
        { label: 'Recorded output', value: 'Unavailable' },
        { label: 'Recorded reasoning', value: 'Unavailable' },
      ]);
    },
  );
});
