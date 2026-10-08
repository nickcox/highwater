import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { resetInteraction } from '../state/interaction';
import { defaultPresentationPreferences } from '../state/presentation-preferences';
import { testAnalysis } from './test-data';
import ContextRiver from './ContextRiver.svelte';
import type { IndexedAnalysis } from '../types';
import type { RiverNavigationCommand, RiverViewportStatus } from './viewport';
import * as layout from './layout';

function economicsTrackButton(container: HTMLElement, name: string): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>('.economics-track-controls button'),
  ].find((candidate) => candidate.textContent?.trim() === name);
  if (!button) throw new Error(`Economics track button not found: ${name}`);
  return button;
}

const callbacks = () => ({
  onViewportChange: vi.fn<(status: RiverViewportStatus) => void>(),
  onSelectionVisibility: vi.fn<(status: { itemId: string; visible: boolean } | null) => void>(),
  onHoverCall: vi.fn<(index: number | null) => void>(),
  onPinCall: vi.fn<(index: number) => void>(),
  onHoverItem: vi.fn<(id: string | null, event?: PointerEvent) => void>(),
  onSelectItem: vi.fn<(id: string) => void>(),
  onEmptyClick: vi.fn<(index: number) => void>(),
  onEscape: vi.fn<() => void>(),
});

const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const rectDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
let riverClientWidth = 300;

async function firePointer(
  target: Element,
  type: string,
  init: {
    pointerId: number;
    pointerType: string;
    button?: number;
    clientX: number;
    clientY: number;
    shiftKey?: boolean;
  },
): Promise<boolean> {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries(init)) Object.defineProperty(event, key, { value });
  return fireEvent(target, event);
}

function rect(left: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    top: 0,
    right: left + width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function longAnalysis(callCount: number): IndexedAnalysis {
  const analysis = testAnalysis();
  const template = analysis.modelCalls[analysis.modelCalls.length - 1];
  const itemIds = [...template.contextItemIds];
  analysis.modelCalls = Array.from({ length: callCount }, (_, position) => {
    const first = position === 0;
    return {
      ...template,
      index: position + 1,
      sourceRecordId: `long-call-${position + 1}`,
      contextItemIds: itemIds,
      addedItemIds: first ? itemIds : [],
      droppedItemIds: [],
      transitionItemCounts: {
        added: first ? itemIds.length : 0,
        retained: first ? 0 : itemIds.length,
        dropped: 0,
      },
      compactionBefore: null,
    };
  });
  analysis.contextItems = analysis.contextItems
    .filter((item) => itemIds.includes(item.id))
    .map((item) => ({
      ...item,
      firstModelCall: 1,
      lastModelCall: callCount,
      presence: [{ startCall: 1, endCall: callCount }],
      presenceCallCount: callCount,
    }));
  analysis.compactions = [];
  analysis.lineage = [];
  return indexAnalysis(analysis);
}

function economicsAnalysis(): IndexedAnalysis {
  const analysis = testAnalysis();
  for (const call of analysis.modelCalls) {
    const input = call.index === 1 ? 750 : 1000;
    const cacheRead = call.index === 1 ? 250 : 0;
    const cacheWrite = 0;
    const promptTokens = input + cacheRead + cacheWrite;
    call.provider = 'anthropic';
    call.api = 'anthropic-messages';
    call.usage = { ...call.usage, input, cacheRead, cacheWrite };
    call.cost = {
      input: 0.0000000123 * call.index,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0.0000000123 * call.index,
    };
    call.economics = {
      ...call.economics,
      policyId: 'anthropic-messages-cache-v1',
      usageCompleteness: 'complete',
      costCompleteness: 'complete',
      cacheWriteStatus: 'reported',
      promptTokens,
      cacheReadRatio: cacheRead / promptTokens,
      cacheWriteRatio: cacheWrite / promptTokens,
      freshRatio: input / promptTokens,
      piPromptCost: 0.0000000123 * call.index,
      cacheRatioDiscontinuity: null,
      explanationCodes: [],
    };
  }
  analysis.modelCalls[3].model = 'different-model';
  analysis.modelCalls[1].economics.cacheRatioDiscontinuity = {
    previousCallIndex: 1,
    direction: 'drop',
    previousRatio: 0.25,
    currentRatio: 0,
    delta: 0.25,
    magnitude: 'notable',
    method: 'adjacent-cache-read-share-v1',
    previousPromptTokens: 1000,
    currentPromptTokens: 1000,
    compactionBefore: analysis.modelCalls[1].compactionBefore,
  };
  const promptTokens = analysis.modelCalls.reduce(
    (sum, call) => sum + (call.economics.promptTokens ?? 0),
    0,
  );
  const cacheReadTokens = analysis.modelCalls.reduce(
    (sum, call) => sum + (call.usage.cacheRead ?? 0),
    0,
  );
  analysis.economics = {
    ...analysis.economics,
    supportedPolicyIds: ['anthropic-messages-cache-v1'],
    usageCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
    costCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
    cacheReadEligibleCalls: 4,
    cacheReadPromptTokens: promptTokens,
    cacheReadTokens,
    cacheReadRatio: cacheReadTokens / promptTokens,
    explanationCodes: [],
  };
  return indexAnalysis(analysis);
}

function appendedAnalysis(): IndexedAnalysis {
  const analysis = testAnalysis();
  const finalCall = analysis.modelCalls[analysis.modelCalls.length - 1];
  analysis.modelCalls.push({
    ...finalCall,
    index: 5,
    sourceRecordId: 'call5',
    addedItemIds: [],
    droppedItemIds: [],
    transitionItemCounts: { added: 0, retained: finalCall.contextItemIds.length, dropped: 0 },
  });
  const presenceByItem: Record<string, { startCall: number; endCall: number }[]> = {
    a: [{ startCall: 1, endCall: 2 }],
    retained: [{ startCall: 2, endCall: 5 }],
    summary: [{ startCall: 3, endCall: 5 }],
    gap: [
      { startCall: 1, endCall: 1 },
      { startCall: 4, endCall: 5 },
    ],
  };
  analysis.contextItems = analysis.contextItems.map((item) => {
    const presence = presenceByItem[item.id];
    return {
      ...item,
      presence,
      presenceCallCount: presence.reduce(
        (sum, range) => sum + range.endCall - range.startCall + 1,
        0,
      ),
      firstModelCall: presence[0].startCall,
      lastModelCall: presence[presence.length - 1].endCall,
    };
  });
  return indexAnalysis(analysis);
}

beforeEach(() => {
  riverClientWidth = 300;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains('river-scroll') ? riverClientWidth : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      const host = this as HTMLElement;
      if (!host.classList.contains('river-scroll')) return 0;
      const chartWidth = Number(host.querySelector('svg')?.getAttribute('width')) || 0;
      return Math.max(riverClientWidth, chartWidth);
    },
  });
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      if (this instanceof SVGSVGElement) {
        const host = this.parentElement as HTMLDivElement;
        return rect(-host.scrollLeft, Number(this.getAttribute('width')) || 0, 500);
      }
      if ((this as HTMLElement).classList?.contains('river-scroll')) return rect(0, 300, 500);
      return rect(0, 0, 0);
    },
  });
});

afterEach(() => {
  cleanup();
  if (clientWidthDescriptor)
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  if (scrollWidthDescriptor)
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidthDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  if (rectDescriptor)
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', rectDescriptor);
  else Reflect.deleteProperty(Element.prototype, 'getBoundingClientRect');
  vi.unstubAllGlobals();
});

describe('ContextRiver continuous viewport integration', () => {
  it('bounds layout work across hover, selection, zoom, pan and hidden updates', async () => {
    const geometry = vi.spyOn(layout, 'layoutContextRiver');
    const columns = vi.spyOn(layout, 'layoutCallColumns');
    const indexed = longAnalysis(160);
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...callbacks() },
    });
    const initialGeometry = geometry.mock.calls.length;
    const initialColumns = columns.mock.calls.length;
    await view.rerender({
      hoveredCallIndex: 2,
      hoveredItemId: indexed.analysis.contextItems[0].id,
    });
    await view.rerender({
      selectedItemId: indexed.analysis.contextItems[0].id,
      pinnedCallIndex: 2,
    });
    expect(geometry.mock.calls.length - initialGeometry).toBe(0);
    expect(columns.mock.calls.length - initialColumns).toBe(0);
    await view.rerender({ navigationCommand: { id: 1, kind: 'zoom-in' } });
    expect(geometry.mock.calls.length - initialGeometry).toBe(0);
    riverClientWidth = 200;
    await fireEvent(window, new Event('resize'));
    await view.rerender({ navigationCommand: { id: 2, kind: 'fit' } });
    await waitFor(() =>
      expect(view.container.querySelector('svg')?.getAttribute('width')).toBe('200'),
    );
    expect(geometry.mock.calls.length - initialGeometry).toBe(0);
    expect(columns.mock.calls.length - initialColumns).toBe(0);
    const beforePan = geometry.mock.calls.length;
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    host.scrollLeft = 50;
    await fireEvent.scroll(host);
    expect(geometry.mock.calls.length - beforePan).toBe(0);
    await view.rerender({ isVisible: false });
    await view.rerender({ selectedItemId: null, hoveredCallIndex: null });
    expect(geometry.mock.calls.length - beforePan).toBe(0);
    geometry.mockRestore();
    columns.mockRestore();
  });
  it('ensures stepped calls are visible without changing spacing or rebuilding geometry', async () => {
    const geometry = vi.spyOn(layout, 'layoutContextRiver');
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed: longAnalysis(160), ...resetInteraction(), ...handlers },
    });
    await view.rerender({ navigationCommand: { id: 1, kind: 'zoom-in' } });
    const host = view.container.querySelector('.river-scroll') as HTMLElement;
    const width = view.container.querySelector('svg')!.getAttribute('width');
    const scroll = host.scrollLeft;
    const centre = handlers.onViewportChange.mock.lastCall![0].centerCallIndex!;
    const count = geometry.mock.calls.length;
    await view.rerender({ navigationCommand: { id: 2, kind: 'ensure-call', callIndex: centre } });
    expect(host.scrollLeft).toBe(scroll);
    await view.rerender({ navigationCommand: { id: 3, kind: 'ensure-call', callIndex: 160 } });
    expect(host.scrollLeft).toBeGreaterThan(scroll);
    expect(view.container.querySelector('svg')!.getAttribute('width')).toBe(width);
    expect(geometry.mock.calls.length).toBe(count);
    geometry.mockRestore();
  });

  it('still rebuilds stacks for analysis, grouping and visible-scale domain changes', async () => {
    const geometry = vi.spyOn(layout, 'layoutContextRiver');
    const view = render(ContextRiver, {
      props: { indexed: longAnalysis(160), ...resetInteraction(), ...callbacks() },
    });
    const settings = defaultPresentationPreferences();
    let previous = geometry.mock.calls.length;
    settings.river.display = 'itemTypes';
    await view.rerender({ preferences: structuredClone(settings) });
    expect(geometry.mock.calls.length).toBeGreaterThan(previous);
    previous = geometry.mock.calls.length;
    settings.river.verticalScale = 'visible';
    await view.rerender({ preferences: structuredClone(settings) });
    expect(geometry.mock.calls.length).toBeGreaterThan(previous);
    previous = geometry.mock.calls.length;
    await view.rerender({ indexed: longAnalysis(161) });
    expect(geometry.mock.calls.length).toBeGreaterThan(previous);
    geometry.mockRestore();
  });

  it('shares the call axis with a bounded keyboard cache track and pins without selecting an item', async () => {
    const indexed = economicsAnalysis();
    const handlers = callbacks();
    const interaction = { ...resetInteraction(), selectedItemId: 'a' };
    const view = render(ContextRiver, {
      props: { indexed, ...interaction, ...handlers },
    });

    await fireEvent.click(view.getByRole('button', { name: 'Cache & cost' }));
    await waitFor(() =>
      expect(view.container.querySelector('.economics-track-svg')).not.toBeNull(),
    );
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    const chartSvgs = host.querySelectorAll(':scope > svg, .economics-track-svg');
    expect(chartSvgs).toHaveLength(2);
    expect(chartSvgs[0].getAttribute('width')).toBe(chartSvgs[1].getAttribute('width'));
    expect(view.getByRole('button', { name: 'Cache' })).toHaveAttribute('aria-pressed', 'true');

    const marks = view.container.querySelectorAll(
      '.economics-track-svg .economics-mark[role="button"]',
    );
    expect(marks).toHaveLength(indexed.analysis.modelCalls.length);
    expect([...marks].filter((mark) => mark.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(marks[0].getAttribute('aria-label')).toContain('Cache read');
    expect(marks[1].getAttribute('aria-label')).toContain('dropped from 25.0% on call 1');
    expect(marks[3].getAttribute('aria-label')).toContain('Target changes from anthropic / m');
    const eventTriggers = view.container.querySelectorAll('.track-event-trigger');
    expect(eventTriggers).toHaveLength(2);
    expect(eventTriggers[0]).toHaveAttribute(
      'aria-label',
      expect.stringContaining('2 economics events'),
    );
    expect(eventTriggers[0]?.querySelector('title')).toHaveTextContent('Cache-read share');
    expect(eventTriggers[0]?.querySelector('title')).toHaveTextContent('Compaction before call 3');
    expect(eventTriggers[1]?.querySelector('title')).toHaveTextContent(
      'Target changes from anthropic / m',
    );
    expect(view.container.querySelectorAll('.event-anchor-connector').length).toBeGreaterThan(0);

    const nextMark = view.container.querySelector('#economics-call-2') as SVGGElement;
    await fireEvent.keyDown(view.container.querySelector('#economics-call-1') as SVGGElement, {
      key: 'ArrowRight',
    });
    expect(handlers.onHoverCall).toHaveBeenLastCalledWith(2);
    expect(document.activeElement).toBe(nextMark);
    await fireEvent.keyDown(nextMark, { key: ' ' });
    expect(handlers.onPinCall).toHaveBeenLastCalledWith(2);

    await fireEvent.click(nextMark);
    expect(handlers.onPinCall).toHaveBeenLastCalledWith(2);
    expect(handlers.onSelectItem).not.toHaveBeenCalled();
    expect(interaction.selectedItemId).toBe('a');
  });

  it('uses individual visible ribbon spans and reveals the nearest present call at current zoom', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const interaction = { ...resetInteraction(), selectedItemId: 'gap', pinnedCallIndex: 2 };
    const view = render(ContextRiver, {
      props: { indexed, ...interaction, selectedItemId: 'gap', ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onSelectionVisibility).toHaveBeenLastCalledWith({
        itemId: 'gap',
        visible: true,
      }),
    );

    await view.rerender({
      indexed,
      ...interaction,
      selectedItemId: 'gap',
      navigationCommand: { id: 1, kind: 'range', startCallIndex: 2, endCallIndex: 3 },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onSelectionVisibility).toHaveBeenLastCalledWith({
        itemId: 'gap',
        visible: false,
      }),
    );
    const zoomedWidth = host.querySelector('svg')?.getAttribute('width');
    const rangeScroll = host.scrollLeft;

    await view.rerender({
      indexed,
      ...interaction,
      selectedItemId: 'gap',
      navigationCommand: {
        id: 2,
        kind: 'reveal-item',
        itemId: 'gap',
        referenceCallIndex: 2,
      },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).not.toBe(rangeScroll));
    expect(host.scrollLeft).toBe(0);
    expect(host.querySelector('svg')?.getAttribute('width')).toBe(zoomedWidth);
    expect(interaction.pinnedCallIndex).toBe(2);
    expect(interaction.selectedItemId).toBe('gap');
    expect(handlers.onPinCall).not.toHaveBeenCalled();
  });

  it('holds an explicit reveal until River is visible and cancels it when its command is removed', async () => {
    const indexed = longAnalysis(160);
    const handlers = callbacks();
    const interaction = {
      ...resetInteraction(),
      selectedItemId: indexed.analysis.modelCalls[0].contextItemIds[0],
      pinnedCallIndex: 80,
    };
    const view = render(ContextRiver, {
      props: { indexed, ...interaction, ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await view.rerender({
      indexed,
      ...interaction,
      navigationCommand: { id: 1, kind: 'range', startCallIndex: 10, endCallIndex: 11 },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBeGreaterThan(0));
    const beforeReveal = host.scrollLeft;

    const command = {
      id: 2,
      kind: 'reveal-item' as const,
      itemId: interaction.selectedItemId!,
      referenceCallIndex: 80,
    };
    await view.rerender({
      indexed,
      ...interaction,
      navigationCommand: command,
      isVisible: false,
      ...handlers,
    });
    expect(host.scrollLeft).toBe(beforeReveal);
    await view.rerender({
      indexed,
      ...interaction,
      navigationCommand: null,
      isVisible: true,
      ...handlers,
    });
    expect(host.scrollLeft).toBe(beforeReveal);

    await view.rerender({
      indexed,
      ...interaction,
      navigationCommand: command,
      isVisible: false,
      ...handlers,
    });
    expect(host.scrollLeft).toBe(beforeReveal);
    await view.rerender({
      indexed,
      ...interaction,
      navigationCommand: command,
      isVisible: true,
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).not.toBe(beforeReveal));
    expect(Number(host.querySelector('svg')?.getAttribute('width'))).toBeGreaterThan(30_000);
    expect(interaction.pinnedCallIndex).toBe(80);
    expect(interaction.selectedItemId).toBe(command.itemId);
  });

  it('keeps explicit track choices across same-session data replacement and shows tiny costs precisely', async () => {
    const indexed = economicsAnalysis();
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    await fireEvent.click(view.getByRole('button', { name: 'Cache & cost' }));
    await waitFor(() =>
      expect(view.container.querySelector('.economics-track-svg')).not.toBeNull(),
    );

    await fireEvent.click(view.getByRole('button', { name: 'Cost' }));
    const track = view.container.querySelector('.economics-track-svg') as SVGSVGElement;
    expect(track.getAttribute('aria-label')).toContain('Harness-recorded cost');
    expect(view.container.querySelector('#economics-call-1')?.getAttribute('aria-label')).toContain(
      '0.0000000123',
    );

    await view.rerender({
      indexed: economicsAnalysis(),
      ...resetInteraction(),
      ...handlers,
    });
    expect(view.getByRole('button', { name: 'Cost' })).toHaveAttribute('aria-pressed', 'true');
    expect(view.container.querySelector('.economics-track-svg')).not.toBeNull();

    await fireEvent.click(view.getByRole('button', { name: 'Off' }));
    expect(view.container.querySelector('.economics-track-svg')).toBeNull();
  });

  it('preserves the panned River viewport, pin, and selection across track switches', async () => {
    const indexed = longAnalysis(160);
    const handlers = callbacks();
    const interaction = {
      ...resetInteraction(),
      selectedItemId: indexed.analysis.modelCalls[0].contextItemIds[0],
      pinnedCallIndex: 80,
    };
    const view = render(ContextRiver, {
      props: { indexed, ...interaction, ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await view.rerender({
      indexed,
      ...interaction,
      navigationCommand: { id: 1, kind: 'range', startCallIndex: 80, endCallIndex: 81 },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBeGreaterThan(0));
    const scrollLeft = host.scrollLeft;
    const riverWidth = host.querySelector('svg')?.getAttribute('width');

    await fireEvent.click(view.getByRole('button', { name: 'Cache & cost' }));
    await fireEvent.click(economicsTrackButton(view.container, 'Cache'));
    await waitFor(() =>
      expect(
        view.container.querySelectorAll('.river-scroll > svg, .river-scroll .economics-track-svg'),
      ).toHaveLength(2),
    );
    expect(host.scrollLeft).toBe(scrollLeft);
    expect(host.querySelector('.economics-track-svg')?.getAttribute('width')).toBe(riverWidth);
    await fireEvent.click(economicsTrackButton(view.container, 'Cost'));
    expect(host.scrollLeft).toBe(scrollLeft);
    expect(
      view.container.querySelectorAll('.river-scroll > svg, .river-scroll .economics-track-svg'),
    ).toHaveLength(2);
    await fireEvent.click(economicsTrackButton(view.container, 'Off'));
    expect(host.scrollLeft).toBe(scrollLeft);
    expect(
      view.container.querySelectorAll('.river-scroll > svg, .river-scroll .economics-track-svg'),
    ).toHaveLength(1);
    expect(interaction.pinnedCallIndex).toBe(80);
    expect(interaction.selectedItemId).toBe(indexed.analysis.modelCalls[0].contextItemIds[0]);
    expect(handlers.onPinCall).not.toHaveBeenCalled();
    expect(handlers.onSelectItem).not.toHaveBeenCalled();
  });

  it('does not auto-open Cache when support appears after the initial analysis', async () => {
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: {
        indexed: indexAnalysis(testAnalysis()),
        ...resetInteraction(),
        ...handlers,
      },
    });
    expect(view.getByRole('button', { name: 'Cache & cost' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await view.rerender({
      indexed: economicsAnalysis(),
      ...resetInteraction(),
      ...handlers,
    });
    expect(view.getByRole('button', { name: 'Cache & cost' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(view.container.querySelector('.economics-track-svg')).toBeNull();
  });
  it('starts fitted, zooms continuously, and returns to Fit all without changing selection', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true, isFitAll: true, totalCallCount: 4 }),
      ),
    );
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    expect(host.scrollLeft).toBe(0);
    expect(host.querySelector('svg')?.getAttribute('width')).toBe('300');

    const zoomIn: RiverNavigationCommand = { id: 1, kind: 'zoom-in' };
    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: zoomIn,
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false, zoomFactor: 1.5 }),
      ),
    );
    expect(Number(host.querySelector('svg')?.getAttribute('width'))).toBeGreaterThan(300);
    expect(host.scrollLeft).toBeGreaterThan(0);

    const beforePan = host.scrollLeft;
    await firePointer(host, 'pointerdown', {
      pointerId: 4,
      pointerType: 'mouse',
      button: 0,
      shiftKey: true,
      clientX: 200,
      clientY: 200,
    });
    await firePointer(host, 'pointermove', {
      pointerId: 4,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 200,
    });
    expect(host.scrollLeft).toBeGreaterThan(beforePan);
    await firePointer(host, 'pointerup', {
      pointerId: 4,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 200,
    });

    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 2, kind: 'latest' },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBe(117));
    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 3, kind: 'fit' },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBe(0));
    expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ isFitAll: true, hasOverflow: false }),
    );

    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 4, kind: 'range', startCallIndex: 2, endCallIndex: 3 },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false, zoomFactor: 3 }),
      ),
    );
    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 5, kind: 'fit' },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );
  });

  it('fits and zooms a long session to an arbitrary keyboard-selected interval', async () => {
    const indexed = longAnalysis(160);
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true, totalCallCount: 160, hasOverflow: false }),
      ),
    );
    expect(host.querySelector('svg')?.getAttribute('width')).toBe('300');

    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'range', startCallIndex: 80, endCallIndex: 81 },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isFitAll: false,
          firstVisibleCallIndex: 80,
          lastVisibleCallIndex: 81,
          zoomFactor: 159,
        }),
      ),
    );
    expect(Number(host.querySelector('svg')?.getAttribute('width'))).toBeGreaterThan(37_000);
    expect(host.scrollLeft).toBeGreaterThan(0);
  });

  it('keeps a requested interval visible when the zoom limit caps spacing', async () => {
    const indexed = longAnalysis(520);
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );

    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'range', startCallIndex: 260, endCallIndex: 261 },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isFitAll: false,
          zoomFactor: 256,
          firstVisibleCallIndex: 260,
          lastVisibleCallIndex: 261,
        }),
      ),
    );
    expect(view.getByRole('button', { name: 'Pin model call 260' })).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Pin model call 261' })).toBeInTheDocument();
  });

  it('dragging a call interval zooms to it while a click still selects an item', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );

    const ribbon = view.getByRole('button', { name: 'bash: npm test' });
    await firePointer(ribbon, 'pointerdown', {
      pointerId: 5,
      pointerType: 'mouse',
      button: 0,
      clientX: 60,
      clientY: 200,
    });
    await firePointer(ribbon, 'pointerup', {
      pointerId: 5,
      pointerType: 'mouse',
      button: 0,
      clientX: 60,
      clientY: 200,
    });
    await fireEvent.click(ribbon, { detail: 1, clientX: 60, clientY: 200 });
    expect(handlers.onSelectItem).toHaveBeenCalledWith('a');
    expect(handlers.onPinCall).toHaveBeenCalledWith(1);
    expect(handlers.onEmptyClick).not.toHaveBeenCalled();

    await firePointer(ribbon, 'pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 80,
      clientY: 200,
    });
    await firePointer(host, 'pointermove', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 220,
      clientY: 200,
    });
    expect(view.container.querySelector('.zoom-selection')).toBeInTheDocument();
    await firePointer(ribbon, 'pointerup', {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 220,
      clientY: 200,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false }),
      ),
    );
    expect(Number(host.querySelector('svg')?.getAttribute('width'))).toBeGreaterThan(300);
    await fireEvent.click(ribbon);
    expect(handlers.onSelectItem).toHaveBeenCalledTimes(1);
    expect(handlers.onPinCall).toHaveBeenCalledTimes(1);
  });

  it('starts range zoom in empty plot space without selecting chart text', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );

    const selectStart = new Event('selectstart', { bubbles: true, cancelable: true });
    host.dispatchEvent(selectStart);
    expect(selectStart.defaultPrevented).toBe(true);
    await firePointer(host, 'pointerdown', {
      pointerId: 6,
      pointerType: 'mouse',
      button: 0,
      clientX: 70,
      clientY: 45,
    });
    await firePointer(host, 'pointermove', {
      pointerId: 6,
      pointerType: 'mouse',
      clientX: 220,
      clientY: 45,
    });
    expect(view.container.querySelector('.zoom-selection')).toBeInTheDocument();
    await firePointer(host, 'pointerup', {
      pointerId: 6,
      pointerType: 'mouse',
      button: 0,
      clientX: 220,
      clientY: 45,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false }),
      ),
    );
    expect(handlers.onSelectItem).not.toHaveBeenCalled();
    expect(handlers.onEmptyClick).not.toHaveBeenCalled();
  });

  it('prioritizes a pinned turn label and prevents x-axis label collisions', async () => {
    const indexed = longAnalysis(160);
    const handlers = callbacks();
    const interaction = { ...resetInteraction(), pinnedCallIndex: 38 };
    const view = render(ContextRiver, { props: { indexed, ...interaction, ...handlers } });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );
    expect(view.getByRole('button', { name: 'Pin model call 38' })).toBeInTheDocument();

    const labels = [...view.container.querySelectorAll('.call-target text')]
      .map((text) => ({
        x: Number(text.getAttribute('x')),
        width: (text.textContent ?? '').length * 7,
      }))
      .sort((a, b) => a.x - b.x);
    for (let position = 1; position < labels.length; position += 1) {
      expect(labels[position]!.x - labels[position - 1]!.x).toBeGreaterThanOrEqual(
        (labels[position]!.width + labels[position - 1]!.width) / 2 + 8,
      );
    }
  });

  it('keeps both endpoints of the selected range visible when the viewport resizes', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true, isFitAll: true }),
      ),
    );
    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'range', startCallIndex: 2, endCallIndex: 3 },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          firstVisibleCallIndex: 2,
          lastVisibleCallIndex: 3,
          zoomFactor: 3,
        }),
      ),
    );
    const zoomedScrollLeft = host.scrollLeft;
    expect(zoomedScrollLeft).toBe(243);

    riverClientWidth = 240;
    window.dispatchEvent(new Event('resize'));
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ firstVisibleCallIndex: 2, lastVisibleCallIndex: 3 }),
      ),
    );
    expect(Number(host.querySelector('svg')?.getAttribute('width'))).toBe(588);
    expect(host.scrollLeft).toBeGreaterThan(0);
  });

  it('supports chart-local modifier-wheel and two-pointer pinch zoom', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );

    const ordinaryWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 150,
      deltaY: 100,
    });
    host.dispatchEvent(ordinaryWheel);
    expect(ordinaryWheel.defaultPrevented).toBe(false);

    const zoomWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 150,
      deltaY: -100,
      ctrlKey: true,
    });
    host.dispatchEvent(zoomWheel);
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false }),
      ),
    );
    expect(handlers.onViewportChange.mock.lastCall?.[0].zoomFactor).toBeCloseTo(Math.exp(0.35), 12);
    expect(zoomWheel.defaultPrevented).toBe(true);

    const zoomOutWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 150,
      deltaY: 100,
      ctrlKey: true,
    });
    host.dispatchEvent(zoomOutWheel);
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );

    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'fit' },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );
    await firePointer(host, 'pointermove', {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: 50,
      clientY: 200,
    });
    await firePointer(host, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 200,
    });
    await firePointer(host, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 200,
      clientY: 200,
    });
    await firePointer(host, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 250,
      clientY: 200,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false }),
      ),
    );
    expect(handlers.onViewportChange.mock.lastCall?.[0].zoomFactor).toBeCloseTo(
      Math.pow(1.5, 1.7),
      12,
    );
    await firePointer(host, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 250,
      clientY: 200,
    });
    await firePointer(host, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 200,
    });
  });

  it('keeps the session-wide Y scale as default and makes visible-call scaling explicit', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );
    expect(view.getByRole('button', { name: 'Session scale' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(view.getByRole('img', { name: /Vertical axis.*estimated tokens/ })).toBeInTheDocument();
    expect(view.container.querySelectorAll('.weight-gridline')).toHaveLength(6);

    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'range', startCallIndex: 3, endCallIndex: 4 },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ firstVisibleCallIndex: 3, lastVisibleCallIndex: 4 }),
      ),
    );
    const sessionPath = view.container
      .querySelector('.ribbon-hit[aria-label="retained tail"]')
      ?.getAttribute('d');
    const scrollBeforeScaleChange = host.scrollLeft;
    await view.getByRole('button', { name: 'Visible calls' }).click();
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Visible calls' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(view.getByRole('img', { name: /visible call markers/ })).toBeInTheDocument();
    expect(
      view.container.querySelector('.ribbon-hit[aria-label="retained tail"]')?.getAttribute('d'),
    ).not.toBe(sessionPath);
    expect(host.scrollLeft).toBe(scrollBeforeScaleChange);
    expect(handlers.onSelectItem).not.toHaveBeenCalled();

    await view.getByRole('button', { name: 'Session scale' }).click();
    expect(
      view.container.querySelector('.ribbon-hit[aria-label="retained tail"]')?.getAttribute('d'),
    ).toBe(sessionPath);
    expect(host.scrollLeft).toBe(scrollBeforeScaleChange);
  });

  it('labels unavailable-weight geometry as structural rather than token-scaled', async () => {
    const analysis = testAnalysis();
    analysis.displayWeightUnit = 'unavailable';
    analysis.tokenAnalysis.chartUnit = 'unavailable';
    const indexed = indexAnalysis(analysis);
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );

    expect(
      view.getByRole('img', {
        name: /structural placeholder stack weight.*token geometry unavailable/,
      }),
    ).toBeInTheDocument();
    expect(view.container.querySelector('#context-river-description')).toHaveTextContent(
      'Token geometry is unavailable; ribbon regions are structural placeholders',
    );
    expect(
      view.queryByRole('img', { name: /Vertical axis.*calculated tokens|estimated tokens/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps call targets and individual ribbons interactive at Fit all', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true, isFitAll: true }),
      ),
    );

    await fireEvent.click(view.getByRole('button', { name: 'Pin model call 1' }));
    expect(handlers.onPinCall).toHaveBeenCalledWith(1);
    await fireEvent.click(view.getByRole('button', { name: 'bash: npm test' }));
    expect(handlers.onSelectItem).toHaveBeenCalledWith('a');
    expect(view.container.querySelector('.ribbon-hit')).toHaveAttribute('pointer-events', 'fill');
  });

  it('keeps Space-pan keyboard handling focused on the chart and clears it on keyup', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );
    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'zoom-in' },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false }),
      ),
    );

    host.focus();
    const spaceDown = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Space',
      key: ' ',
    });
    host.dispatchEvent(spaceDown);
    expect(spaceDown.defaultPrevented).toBe(true);
    const beforePan = host.scrollLeft;
    const panFromX = beforePan > 0 ? 100 : 200;
    const panToX = beforePan > 0 ? 200 : 100;
    await firePointer(host, 'pointerdown', {
      pointerId: 71,
      pointerType: 'mouse',
      button: 0,
      clientX: panFromX,
      clientY: 200,
    });
    await firePointer(host, 'pointermove', {
      pointerId: 71,
      pointerType: 'mouse',
      clientX: panToX,
      clientY: 200,
    });
    expect(host.scrollLeft).not.toBe(beforePan);
    await firePointer(host, 'pointerup', {
      pointerId: 71,
      pointerType: 'mouse',
      clientX: panToX,
      clientY: 200,
    });
    window.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, code: 'Space', key: ' ' }));

    const afterPan = host.scrollLeft;
    await firePointer(host, 'pointerdown', {
      pointerId: 72,
      pointerType: 'mouse',
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    await firePointer(host, 'pointermove', {
      pointerId: 72,
      pointerType: 'mouse',
      clientX: 100,
      clientY: 140,
    });
    expect(host.scrollLeft).toBe(afterPan);
    await firePointer(host, 'pointerup', {
      pointerId: 72,
      pointerType: 'mouse',
      clientX: 100,
      clientY: 140,
    });
  });

  it.each(['pointercancel', 'lostpointercapture'])(
    'cancels an in-progress range gesture on %s and accepts a later gesture',
    async (cancelEvent) => {
      const indexed = indexAnalysis(testAnalysis());
      const handlers = callbacks();
      const view = render(ContextRiver, {
        props: { indexed, ...resetInteraction(), ...handlers },
      });
      const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
      await waitFor(() =>
        expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
          expect.objectContaining({ isFitAll: true }),
        ),
      );

      await firePointer(host, 'pointerdown', {
        pointerId: 31,
        pointerType: 'mouse',
        button: 0,
        clientX: 80,
        clientY: 45,
      });
      await firePointer(host, 'pointermove', {
        pointerId: 31,
        pointerType: 'mouse',
        clientX: 220,
        clientY: 45,
      });
      expect(view.container.querySelector('.zoom-selection')).toBeInTheDocument();
      await firePointer(host, cancelEvent, {
        pointerId: 31,
        pointerType: 'mouse',
        clientX: 220,
        clientY: 45,
      });
      expect(view.container.querySelector('.zoom-selection')).not.toBeInTheDocument();
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      );

      await firePointer(host, 'pointerdown', {
        pointerId: 32,
        pointerType: 'mouse',
        button: 0,
        clientX: 80,
        clientY: 45,
      });
      await firePointer(host, 'pointermove', {
        pointerId: 32,
        pointerType: 'mouse',
        clientX: 220,
        clientY: 45,
      });
      await firePointer(host, 'pointerup', {
        pointerId: 32,
        pointerType: 'mouse',
        clientX: 220,
        clientY: 45,
      });
      await waitFor(() =>
        expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
          expect.objectContaining({ isFitAll: false }),
        ),
      );
    },
  );

  it('finishes a drag released outside the chart and cancels cleanly on window blur', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: true }),
      ),
    );

    await firePointer(host, 'pointerdown', {
      pointerId: 41,
      pointerType: 'mouse',
      button: 0,
      clientX: 80,
      clientY: 45,
    });
    await firePointer(document.body, 'pointermove', {
      pointerId: 41,
      pointerType: 'mouse',
      clientX: 220,
      clientY: 45,
    });
    await firePointer(document.body, 'pointerup', {
      pointerId: 41,
      pointerType: 'mouse',
      clientX: 220,
      clientY: 45,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false }),
      ),
    );

    await view.rerender({
      indexed,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'zoom-in' },
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ isFitAll: false }),
      ),
    );
    const beforePan = host.scrollLeft;
    const panFromX = beforePan > 0 ? 100 : 200;
    const panToX = beforePan > 0 ? 200 : 100;
    await firePointer(host, 'pointerdown', {
      pointerId: 42,
      pointerType: 'mouse',
      button: 0,
      shiftKey: true,
      clientX: panFromX,
      clientY: 200,
    });
    await firePointer(host, 'pointermove', {
      pointerId: 42,
      pointerType: 'mouse',
      clientX: panToX,
      clientY: 200,
    });
    const scrollAtBlur = host.scrollLeft;
    expect(scrollAtBlur).not.toBe(beforePan);
    window.dispatchEvent(new Event('blur'));
    await firePointer(document.body, 'pointermove', {
      pointerId: 42,
      pointerType: 'mouse',
      clientX: 20,
      clientY: 200,
    });
    expect(host.scrollLeft).toBe(scrollAtBlur);
  });

  it('removes window gesture listeners and releases the gesture state on teardown', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );
    await firePointer(host, 'pointerdown', {
      pointerId: 51,
      pointerType: 'mouse',
      button: 0,
      shiftKey: true,
      clientX: 200,
      clientY: 200,
    });
    view.unmount();
    const callbackCount = handlers.onViewportChange.mock.calls.length;
    await firePointer(document.body, 'pointermove', {
      pointerId: 51,
      pointerType: 'mouse',
      clientX: 100,
      clientY: 200,
    });
    await firePointer(document.body, 'pointerup', {
      pointerId: 51,
      pointerType: 'mouse',
      clientX: 100,
      clientY: 200,
    });
    expect(handlers.onViewportChange).toHaveBeenCalledTimes(callbackCount);
  });

  it("preserves the user's zoom and visible call anchor across live append reflow", async () => {
    const initial = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed: initial, ...resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );
    await view.rerender({
      indexed: initial,
      ...resetInteraction(),
      navigationCommand: { id: 1, kind: 'zoom-in' },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBeGreaterThan(0));
    const oldScrollLeft = host.scrollLeft;
    const oldWidth = Number(host.querySelector('svg')?.getAttribute('width'));

    await view.rerender({
      indexed: appendedAnalysis(),
      ...resetInteraction(),
      ...handlers,
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ totalCallCount: 5, isFitAll: false }),
      ),
    );
    expect(host.scrollLeft).toBe(oldScrollLeft);
    expect(Number(host.querySelector('svg')?.getAttribute('width'))).toBeGreaterThan(oldWidth);
  });
});
