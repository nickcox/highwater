import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePointer, installRiverDom, releasePointer } from './dom-interaction';

function handlers() {
  return {
    onScroll: vi.fn(),
    onDocumentScroll: vi.fn(),
    onWheel: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
    onKeyUp: vi.fn(),
    onBlur: vi.fn(),
    onResize: vi.fn(),
  };
}
const originalResizeObserver = globalThis.ResizeObserver;
afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  vi.restoreAllMocks();
});

describe('River DOM ownership', () => {
  it('disconnects observers and ignores queued resize callbacks after disposal', () => {
    let callback: ResizeObserverCallback = () => {};
    const disconnect = vi.fn();
    globalThis.ResizeObserver = class {
      constructor(next: ResizeObserverCallback) {
        callback = next;
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    };
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { value: 300 });
    const h = handlers();
    const dispose = installRiverDom(host, h);
    expect(h.onResize).toHaveBeenCalledWith(300, 'element');
    const entries = [{ contentRect: { width: 500 } }] as ResizeObserverEntry[];
    callback(entries, {} as ResizeObserver);
    expect(h.onResize).toHaveBeenLastCalledWith(500, 'observer');
    dispose();
    dispose();
    callback(entries, {} as ResizeObserver);
    expect(h.onResize).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('resize'));
    expect(h.onResize).toHaveBeenCalledTimes(2);
  });

  it('removes every event owner before remount, including outside-plot cancellation', () => {
    const host = document.createElement('div');
    const first = handlers();
    const disposeFirst = installRiverDom(host, first);
    window.dispatchEvent(new Event('pointerup'));
    expect(first.onPointerUp).toHaveBeenCalledOnce();
    disposeFirst();
    const second = handlers();
    const disposeSecond = installRiverDom(host, second);
    try {
      for (const name of [
        'pointermove',
        'pointerup',
        'pointercancel',
        'lostpointercapture',
        'keyup',
        'blur',
      ])
        window.dispatchEvent(new Event(name));
      host.dispatchEvent(new Event('scroll'));
      host.dispatchEvent(new Event('wheel'));
      document.dispatchEvent(new Event('scroll'));
      expect(second.onPointerMove).toHaveBeenCalledOnce();
      expect(second.onPointerUp).toHaveBeenCalledOnce();
      expect(second.onPointerCancel).toHaveBeenCalledTimes(2);
      expect(second.onKeyUp).toHaveBeenCalledOnce();
      expect(second.onBlur).toHaveBeenCalledOnce();
      expect(second.onScroll).toHaveBeenCalledOnce();
      expect(second.onWheel).toHaveBeenCalledOnce();
      expect(second.onDocumentScroll).toHaveBeenCalledOnce();
      expect(first.onPointerUp).toHaveBeenCalledOnce();
      expect(first.onPointerCancel).not.toHaveBeenCalled();
    } finally {
      disposeSecond();
    }
    window.dispatchEvent(new Event('pointermove'));
    expect(second.onPointerMove).toHaveBeenCalledOnce();
  });

  it('tolerates rejected and already-released pointer capture', () => {
    const host = document.createElement('div');
    host.setPointerCapture = vi.fn(() => {
      throw new Error('inactive pointer');
    });
    host.hasPointerCapture = vi.fn(() => true);
    host.releasePointerCapture = vi.fn(() => {
      throw new Error('already released');
    });
    expect(() => capturePointer(host, 1)).not.toThrow();
    expect(() => releasePointer(host, 1)).not.toThrow();
  });
});
