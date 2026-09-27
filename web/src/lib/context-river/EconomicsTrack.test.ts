import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from './test-data';
import EconomicsTrack from './EconomicsTrack.svelte';

afterEach(cleanup);

function renderCostTrack(values: Array<number | null>) {
  const analysis = testAnalysis();
  analysis.modelCalls.forEach((call, index) => {
    const total = values[index] ?? null;
    call.cost =
      total === null
        ? { input: null, output: null, cacheRead: null, cacheWrite: null, total: null }
        : { input: total, output: 0, cacheRead: 0, cacheWrite: 0, total };
  });
  const indexed = indexAnalysis(analysis);
  const columns = analysis.modelCalls.map((call, index) => ({
    callIndex: call.index,
    x: 80 + index * 100,
    totalDisplayWeight: 1,
  }));
  const view = render(EconomicsTrack, {
    props: {
      indexed,
      columns,
      width: 600,
      mode: 'cost',
      pinnedCallIndex: null,
      hoveredCallIndex: null,
      onPinCall: () => {},
      onHoverCall: () => {},
      onMarkClick: () => {},
    },
  });
  return view.container;
}

describe('EconomicsTrack cost scaling', () => {
  it.each([
    ['sub-dollar values', [0.03, 0.01, null, 0]],
    ['micro-dollar values', [0.0000000123, 0.0000000001, null, 0]],
  ])('uses the positive session maximum for %s', (_description, values) => {
    const container = renderCostTrack(values as Array<number | null>);
    const positiveDots = [...container.querySelectorAll<SVGCircleElement>('.cost-dot')];
    expect(positiveDots.length).toBeGreaterThan(0);
    const topPoint = Math.min(...positiveDots.map((dot) => Number(dot.getAttribute('cy'))));
    expect(topPoint).toBeCloseTo(14, 5);
    const nonzeroPoint = Math.max(...positiveDots.map((dot) => Number(dot.getAttribute('cy'))));
    expect(nonzeroPoint).toBeLessThan(108);
  });

  it('retains a distinct zero mark when every known cost is zero', () => {
    const container = renderCostTrack([0, 0, null, 0]);
    expect(container.querySelectorAll('.cost-dot')).toHaveLength(0);
    expect(container.querySelectorAll('.cost-zero')).toHaveLength(3);
    expect(container.querySelectorAll('.missing-mark')).toHaveLength(1);
  });

  it('refreshes the pinned readout when switching from tokens to share', async () => {
    const analysis = testAnalysis();
    analysis.modelCalls.forEach((call) => {
      call.provider = 'anthropic';
      call.api = 'anthropic-messages';
      call.usage = { ...call.usage, input: 50, cacheRead: 50, cacheWrite: 0 };
      call.economics = {
        ...call.economics,
        policyId: 'anthropic-messages-cache-v1',
        usageCompleteness: 'complete',
        costCompleteness: 'complete',
        promptTokens: 100,
        cacheReadRatio: 0.5,
        cacheWriteStatus: 'reported',
        cacheWriteRatio: 0,
        freshRatio: 0.5,
        piPromptCost: 0,
      };
    });
    analysis.economics = {
      ...analysis.economics,
      supportedPolicyIds: ['anthropic-messages-cache-v1'],
      usageCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
      costCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
      cacheReadEligibleCalls: 4,
      cacheReadPromptTokens: 400,
      cacheReadTokens: 200,
      cacheReadRatio: 0.5,
    };
    const onReadoutChange = vi.fn();
    const props = {
      indexed: indexAnalysis(analysis),
      columns: analysis.modelCalls.map((modelCall, index) => ({
        callIndex: modelCall.index,
        x: 80 + index * 100,
        totalDisplayWeight: 1,
      })),
      width: 600,
      mode: 'cache' as const,
      cacheView: 'tokens' as const,
      pinnedCallIndex: 1,
      hoveredCallIndex: null,
      onPinCall: () => {},
      onHoverCall: () => {},
      onMarkClick: () => {},
      onReadoutChange,
    };
    const view = render(EconomicsTrack, { props });
    await view.rerender({ ...props, cacheView: 'share' });
    expect(onReadoutChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Source-normalized denominator of 100 prompt tokens'),
    );
    expect(onReadoutChange).toHaveBeenLastCalledWith(expect.stringContaining('50.0%'));
  });

  it('clusters adjacent events in a separate lane without pinning on open', async () => {
    const analysis = testAnalysis();
    analysis.modelCalls.forEach((call, index) => {
      call.provider = 'anthropic';
      call.api = 'anthropic-messages';
      call.usage = {
        ...call.usage,
        input: index === 0 ? 500 : 1000,
        cacheRead: index === 0 ? 500 : 0,
        cacheWrite: 0,
      };
      call.economics = {
        ...call.economics,
        policyId: 'anthropic-messages-cache-v1',
        usageCompleteness: 'complete',
        promptTokens: 1000,
        cacheReadRatio: index === 0 ? 0.5 : 0,
        cacheWriteStatus: 'reported',
        costCompleteness: 'complete',
        cacheWriteRatio: 0,
        freshRatio: index === 0 ? 0.5 : 1,
        piPromptCost: 0,
        cacheRatioDiscontinuity: null,
      };
    });
    analysis.economics = {
      ...analysis.economics,
      supportedPolicyIds: ['anthropic-messages-cache-v1'],
      usageCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
      costCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
      cacheReadEligibleCalls: 4,
      cacheReadPromptTokens: 4000,
      cacheReadTokens: 500,
      cacheReadRatio: 0.125,
    };
    analysis.modelCalls[1].economics.cacheRatioDiscontinuity = {
      previousCallIndex: 1,
      direction: 'drop',
      previousRatio: 0.5,
      currentRatio: 0,
      delta: 0.5,
      magnitude: 'large',
      method: 'adjacent-cache-read-share-v1',
      previousPromptTokens: 1000,
      currentPromptTokens: 1000,
      compactionBefore: null,
    };
    analysis.modelCalls[3].model = 'different-model';
    const onPinCall = vi.fn();
    const onEventBreakdownChange = vi.fn();
    const view = render(EconomicsTrack, {
      props: {
        indexed: indexAnalysis(analysis),
        columns: analysis.modelCalls.map((call, index) => ({
          callIndex: call.index,
          x: 80 + index * 10,
          totalDisplayWeight: 1,
        })),
        width: 160,
        mode: 'cache',
        pinnedCallIndex: null,
        hoveredCallIndex: null,
        onPinCall,
        onHoverCall: () => {},
        onMarkClick: () => {},
        onEventBreakdownChange,
      },
    });

    const cluster = view.container.querySelector('.track-event-cluster') as SVGGElement;
    expect(cluster).not.toBeNull();
    expect(cluster.querySelector('.event-count-badge')).not.toBeNull();
    await fireEvent.click(cluster);
    expect(onEventBreakdownChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        events: expect.arrayContaining([expect.objectContaining({ callIndex: 2 })]),
      }),
    );
    const replacement = structuredClone(analysis);
    replacement.modelCalls[1].usage.input = 750;
    replacement.modelCalls[1].usage.cacheRead = 250;
    replacement.modelCalls[1].economics.cacheReadRatio = 0.25;
    replacement.modelCalls[1].economics.freshRatio = 0.75;
    replacement.modelCalls[1].economics.cacheRatioDiscontinuity!.currentRatio = 0.25;
    replacement.modelCalls[1].economics.cacheRatioDiscontinuity!.delta = 0.25;
    replacement.modelCalls[1].economics.cacheRatioDiscontinuity!.magnitude = 'notable';
    replacement.modelCalls[3].model = 'replacement-model';
    await view.rerender({
      indexed: indexAnalysis(replacement),
      columns: analysis.modelCalls.map((call, index) => ({
        callIndex: call.index,
        x: 80 + index * 10,
        totalDisplayWeight: 1,
      })),
      mode: 'cache',
      pinnedCallIndex: null,
      hoveredCallIndex: null,
      onPinCall,
      onHoverCall: () => {},
      onMarkClick: () => {},
      onEventBreakdownChange,
    });
    const updatedBreakdown = onEventBreakdownChange.mock.lastCall?.[0];
    expect(updatedBreakdown.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining('25.0%') }),
        expect.objectContaining({ label: expect.stringContaining('replacement-model') }),
      ]),
    );
    expect(onPinCall).not.toHaveBeenCalled();
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(cluster).toHaveFocus();
  });
});
