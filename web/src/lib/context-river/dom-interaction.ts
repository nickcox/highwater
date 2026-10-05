import type { GesturePointer } from './gestures';

/** DOM ownership only. Gesture/navigation decisions and mutable view state remain in River. */
export interface RiverDomHandlers {
  onScroll(): void;
  onDocumentScroll(): void;
  onWheel(event: WheelEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
  onPointerCancel(event: PointerEvent): void;
  onKeyUp(event: KeyboardEvent): void;
  onBlur(): void;
  onResize(width: number, source: 'element' | 'observer'): void;
}

export function installRiverDom(host: HTMLDivElement, handlers: RiverDomHandlers): () => void {
  let disposed = false;
  const measure = () => {
    if (!disposed && host.clientWidth > 0) handlers.onResize(host.clientWidth, 'element');
  };
  host.addEventListener('scroll', handlers.onScroll, { passive: true });
  host.addEventListener('wheel', handlers.onWheel, { passive: false });
  window.addEventListener('pointermove', handlers.onPointerMove);
  window.addEventListener('pointerup', handlers.onPointerUp);
  window.addEventListener('pointercancel', handlers.onPointerCancel);
  window.addEventListener('lostpointercapture', handlers.onPointerCancel);
  window.addEventListener('keyup', handlers.onKeyUp);
  window.addEventListener('blur', handlers.onBlur);
  document.addEventListener('scroll', handlers.onDocumentScroll, true);
  window.addEventListener('resize', measure);
  measure();
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver((entries) => {
          if (disposed) return;
          const width = entries[0]?.contentRect.width;
          if (width && width > 0) handlers.onResize(width, 'observer');
        });
  observer?.observe(host);
  return () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    host.removeEventListener('scroll', handlers.onScroll);
    host.removeEventListener('wheel', handlers.onWheel);
    window.removeEventListener('pointermove', handlers.onPointerMove);
    window.removeEventListener('pointerup', handlers.onPointerUp);
    window.removeEventListener('pointercancel', handlers.onPointerCancel);
    window.removeEventListener('lostpointercapture', handlers.onPointerCancel);
    window.removeEventListener('keyup', handlers.onKeyUp);
    window.removeEventListener('blur', handlers.onBlur);
    document.removeEventListener('scroll', handlers.onDocumentScroll, true);
    window.removeEventListener('resize', measure);
  };
}

export function pointerInput(event: PointerEvent): GesturePointer & { shiftKey: boolean } {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    x: event.clientX,
    y: event.clientY,
    shiftKey: event.shiftKey,
  };
}

export function capturePointer(host: HTMLElement, pointerId: number): void {
  try {
    host.setPointerCapture(pointerId);
  } catch {
    /* May reject inactive pointers or lack capture support. */
  }
}

export function releasePointer(host: HTMLElement, pointerId: number): void {
  try {
    if (host.hasPointerCapture?.(pointerId)) host.releasePointerCapture(pointerId);
  } catch {
    /* Capture may already have been released. */
  }
}
