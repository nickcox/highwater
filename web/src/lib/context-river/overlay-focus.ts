import { tick } from 'svelte';

/** A per-owner ticket invalidates pending focus work on close, replacement or disposal. */
export function createOverlayFocus(afterUpdate: () => Promise<unknown> = tick) {
  let revision = 0;
  let disposed = false;
  let identity: object | null = null;
  return {
    observeIdentity(next: object): void {
      if (disposed) return;
      if (identity !== next) {
        identity = next;
        revision += 1;
      }
    },
    focusAfterUpdate(
      resolveTarget: () => HTMLElement | SVGElement | null,
      isCurrent: () => boolean = () => true,
      focusOptions?: FocusOptions,
    ): void {
      if (disposed) return;
      const ticket = ++revision;
      void afterUpdate().then(() => {
        if (disposed || ticket !== revision || !isCurrent()) return;
        const target = resolveTarget();
        if (target?.isConnected && !target.closest('[hidden]')) {
          if (focusOptions) target.focus(focusOptions);
          else target.focus();
        }
      });
    },
    cancel(): void {
      revision += 1;
    },
    dispose(): void {
      disposed = true;
      identity = null;
      revision += 1;
    },
  };
}
