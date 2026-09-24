import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContextRiverNavigation from './ContextRiverNavigation.svelte';
import type { RiverViewportStatus } from '../context-river/viewport';

afterEach(cleanup);

const zoomedViewport: RiverViewportStatus = {
  ready: true,
  isFitAll: false,
  zoomFactor: 3.2,
  canZoomIn: true,
  canZoomOut: true,
  totalCallCount: 73,
  firstVisibleCallIndex: 1,
  lastVisibleCallIndex: 15,
  hasOverflow: true,
};

const navigationCallbacks = () => ({
  onJumpToCall: vi.fn<(callIndex: number) => void>(),
  onZoomToRange: vi.fn<(startCallIndex: number, endCallIndex: number) => void>(),
  onLatest: vi.fn<() => void>(),
  onFitAll: vi.fn<() => void>(),
  onZoomIn: vi.fn<() => void>(),
  onZoomOut: vi.fn<() => void>(),
});

describe('ContextRiverNavigation', () => {
  it('shows the visible call range, zoom controls, and manual navigation', () => {
    const { container } = render(ContextRiverNavigation, {
      props: {
        viewport: zoomedViewport,
        callIndices: Array.from({ length: 73 }, (_, index) => index + 1),
        ...navigationCallbacks(),
      },
    });
    expect(screen.getByTestId('visible-call-range')).toHaveTextContent('Calls 1–15 of 73');
    expect(
      screen.getByText('Drag a range to zoom · scroll or Shift-drag to pan.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit all calls' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Latest' })).toBeEnabled();
    expect(screen.getByText('Zoom 3.2×')).toBeInTheDocument();
    expect(screen.getByText('Go to…')).toBeInTheDocument();
    expect((container.querySelector('.go-to-disclosure') as HTMLDetailsElement).open).toBe(false);
  });

  it('keeps gesture guidance stable across viewport range changes', async () => {
    const callbacks = navigationCallbacks();
    const view = render(ContextRiverNavigation, {
      props: {
        viewport: zoomedViewport,
        callIndices: Array.from({ length: 73 }, (_, index) => index + 1),
        ...callbacks,
      },
    });
    const hint = 'Drag a range to zoom · scroll or Shift-drag to pan.';
    expect(screen.getByText(hint)).toBeInTheDocument();

    await view.rerender({
      viewport: {
        ...zoomedViewport,
        isFitAll: true,
        zoomFactor: 1,
        hasOverflow: false,
        firstVisibleCallIndex: 1,
        lastVisibleCallIndex: 73,
      },
      callIndices: Array.from({ length: 73 }, (_, index) => index + 1),
      ...callbacks,
    });
    expect(screen.getByText(hint)).toBeInTheDocument();
  });

  it('validates and clamps jump requests to available call indices', async () => {
    const callbacks = navigationCallbacks();
    render(ContextRiverNavigation, {
      props: { viewport: zoomedViewport, callIndices: [1, 4, 8], ...callbacks },
    });
    await fireEvent.click(screen.getByText('Go to…'));
    const input = screen.getByRole('spinbutton', { name: 'Call number' });
    await fireEvent.input(input, { target: { value: '99' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(callbacks.onJumpToCall).toHaveBeenCalledWith(8);
    expect(screen.getByRole('status')).toHaveTextContent('moving to call 8');

    await fireEvent.input(input, { target: { value: '5' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(callbacks.onJumpToCall).toHaveBeenLastCalledWith(4);

    await fireEvent.input(input, { target: { value: '2.5' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('status')).toHaveTextContent('Enter a whole-number call index');
  });

  it('validates keyboard-selected call ranges and normalizes their direction', async () => {
    const callbacks = navigationCallbacks();
    render(ContextRiverNavigation, {
      props: { viewport: zoomedViewport, callIndices: [1, 4, 8], ...callbacks },
    });
    await fireEvent.click(screen.getByText('Go to…'));
    const start = screen.getByRole('spinbutton', { name: 'Range start call' });
    const end = screen.getByRole('spinbutton', { name: 'Range end call' });
    await fireEvent.input(start, { target: { value: '8' } });
    await fireEvent.input(end, { target: { value: '4' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom to range' }));
    expect(callbacks.onZoomToRange).toHaveBeenCalledWith(4, 8);

    await fireEvent.input(start, { target: { value: '1.5' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom to range' }));
    expect(screen.getByRole('status')).toHaveTextContent('Enter whole-number start and end');
  });

  it('opens Go to controls as a disclosure and closes it on Escape with focus restored', async () => {
    render(ContextRiverNavigation, {
      props: {
        viewport: zoomedViewport,
        callIndices: [1, 4, 8],
        ...navigationCallbacks(),
      },
    });
    const summary = screen.getByText('Go to…');
    const details = document.querySelector('.go-to-disclosure') as HTMLDetailsElement;
    await fireEvent.click(summary);
    expect(details.open).toBe(true);
    const input = screen.getByRole('spinbutton', { name: 'Call number' });
    input.focus();
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it('requests zoom, Fit all, and Latest without changing call selection', async () => {
    const callbacks = navigationCallbacks();
    render(ContextRiverNavigation, {
      props: { viewport: zoomedViewport, callIndices: [1, 2], ...callbacks },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Fit all calls' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Latest' }));
    expect(callbacks.onZoomIn).toHaveBeenCalledOnce();
    expect(callbacks.onZoomOut).toHaveBeenCalledOnce();
    expect(callbacks.onFitAll).toHaveBeenCalledOnce();
    expect(callbacks.onLatest).toHaveBeenCalledOnce();
  });

  it('disables zoom-out and Fit all at the overview while keeping zoom-in available', () => {
    render(ContextRiverNavigation, {
      props: {
        viewport: {
          ...zoomedViewport,
          isFitAll: true,
          zoomFactor: 1,
          canZoomOut: false,
          hasOverflow: false,
          firstVisibleCallIndex: 1,
          lastVisibleCallIndex: 73,
        },
        callIndices: Array.from({ length: 73 }, (_, index) => index + 1),
        ...navigationCallbacks(),
      },
    });
    expect(screen.getByRole('button', { name: 'Fit all calls' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Latest' })).toBeDisabled();
  });

  it('updates the visible range as viewport measurement and scrolling change', async () => {
    const view = render(ContextRiverNavigation, {
      props: {
        viewport: {
          ...zoomedViewport,
          ready: false,
          firstVisibleCallIndex: null,
          lastVisibleCallIndex: null,
        },
        callIndices: Array.from({ length: 73 }, (_, index) => index + 1),
        ...navigationCallbacks(),
      },
    });
    expect(screen.getByTestId('visible-call-range')).toHaveTextContent('Measuring chart viewport');
    await view.rerender({
      viewport: { ...zoomedViewport, firstVisibleCallIndex: 3, lastVisibleCallIndex: 19 },
      callIndices: Array.from({ length: 73 }, (_, index) => index + 1),
      ...navigationCallbacks(),
    });
    expect(screen.getByTestId('visible-call-range')).toHaveTextContent('Calls 3–19 of 73');
  });

  it('does not claim a visible range for empty sessions', () => {
    const view = render(ContextRiverNavigation, {
      props: {
        viewport: { ...zoomedViewport, ready: false, totalCallCount: 0, hasOverflow: false },
        callIndices: [],
        ...navigationCallbacks(),
      },
    });
    expect(screen.getByTestId('visible-call-range')).toHaveTextContent('No model calls');
    expect(screen.getByRole('button', { name: 'Latest' })).toBeDisabled();
    view.rerender({
      viewport: { ...zoomedViewport, ready: true, totalCallCount: 0, hasOverflow: false },
      callIndices: [],
      ...navigationCallbacks(),
    });
    expect(screen.getByTestId('visible-call-range')).toHaveTextContent('No model calls');
  });
});
