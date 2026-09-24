import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { resetInteraction } from '../state/interaction';
import { testAnalysis } from './test-data';
import ContextRiver from './ContextRiver.svelte';
import type { IndexedAnalysis } from '../types';
import type { RiverNavigationCommand, RiverViewportStatus } from './viewport';

const callbacks = () => ({
  onViewportChange: vi.fn<(status: RiverViewportStatus) => void>(),
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
  it('starts fitted, zooms continuously, and returns to Fit all without changing selection', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      interaction: resetInteraction(),
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
      interaction: resetInteraction(),
      navigationCommand: { id: 2, kind: 'latest' },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBe(117));
    await view.rerender({
      indexed,
      interaction: resetInteraction(),
      navigationCommand: { id: 3, kind: 'fit' },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBe(0));
    expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ isFitAll: true, hasOverflow: false }),
    );

    await view.rerender({
      indexed,
      interaction: resetInteraction(),
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
      interaction: resetInteraction(),
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      interaction: resetInteraction(),
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
    });
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );

    await view.rerender({
      indexed,
      interaction: resetInteraction(),
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
    const view = render(ContextRiver, { props: { indexed, interaction, ...handlers } });
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true, isFitAll: true }),
      ),
    );
    await view.rerender({
      indexed,
      interaction: resetInteraction(),
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      interaction: resetInteraction(),
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      interaction: resetInteraction(),
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
    expect(view.getByText(/visible call markers/)).toBeInTheDocument();
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
    expect(
      view.getByText(/Ribbon heights are structural placeholders, not token measurements/),
    ).toBeInTheDocument();
    expect(
      view.queryByRole('img', { name: /Vertical axis.*calculated tokens|estimated tokens/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps call targets and individual ribbons interactive at Fit all', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const handlers = callbacks();
    const view = render(ContextRiver, {
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );
    await view.rerender({
      indexed,
      interaction: resetInteraction(),
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
        props: { indexed, interaction: resetInteraction(), ...handlers },
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      interaction: resetInteraction(),
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
      props: { indexed, interaction: resetInteraction(), ...handlers },
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
      props: { indexed: initial, interaction: resetInteraction(), ...handlers },
    });
    const host = view.container.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() =>
      expect(handlers.onViewportChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ ready: true }),
      ),
    );
    await view.rerender({
      indexed: initial,
      interaction: resetInteraction(),
      navigationCommand: { id: 1, kind: 'zoom-in' },
      ...handlers,
    });
    await waitFor(() => expect(host.scrollLeft).toBeGreaterThan(0));
    const oldScrollLeft = host.scrollLeft;
    const oldWidth = Number(host.querySelector('svg')?.getAttribute('width'));

    await view.rerender({
      indexed: appendedAnalysis(),
      interaction: resetInteraction(),
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
