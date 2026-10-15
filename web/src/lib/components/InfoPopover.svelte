<script lang="ts">
  // A small "i" button beside a value that opens an explanation next to it. It closes on
  // Escape, on a second click, or on a click anywhere else.
  import { tick, type Snippet } from 'svelte';

  let { id, label, children }: { id: string; label: string; children?: Snippet } = $props();

  let trigger: HTMLButtonElement | null = $state(null);
  let popover: HTMLDivElement | null = $state(null);
  let popoverStyle = $state('');
  let expanded = $state(false);
  // Invisible until placed, so it never shows at the browser's default position.
  let placed = $state(false);

  /** Below the button, or above it when there is no room below, within the window. The
   * width comes from the stylesheet, so the height measured here is the final one. */
  function place(): void {
    if (!expanded || !trigger || !popover) return;
    const margin = 12;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const bounds = trigger.getBoundingClientRect();
    const left = Math.max(margin, Math.min(bounds.left - 8, window.innerWidth - width - margin));
    const below = bounds.bottom + 6;
    const top =
      below + height <= window.innerHeight - margin
        ? below
        : Math.max(margin, bounds.top - height - 6);
    popoverStyle = `left:${Math.round(left)}px;top:${Math.round(top)}px`;
    placed = true;
  }

  async function open(): Promise<void> {
    placed = false;
    expanded = true;
    await tick();
    place();
  }

  function close(restoreFocus: boolean): void {
    if (!expanded) return;
    expanded = false;
    placed = false;
    if (restoreFocus) trigger?.focus();
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  }

  function pointerdown(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (trigger?.contains(target) || popover?.contains(target)) return;
    close(false);
  }
</script>

<svelte:window onresize={place} onscroll={place} onpointerdown={pointerdown} />

<span class="info" role="presentation" onkeydown={keydown}>
  <button
    bind:this={trigger}
    type="button"
    class="info-trigger"
    aria-label={label}
    aria-expanded={expanded}
    aria-controls={id}
    onclick={() => (expanded ? close(true) : open())}>i</button
  >
  <div
    {id}
    bind:this={popover}
    class="info-popover"
    class:placing={!placed}
    role="note"
    hidden={!expanded}
    style={popoverStyle}
  >
    {@render children?.()}
  </div>
</span>

<style>
  .info {
    display: inline-flex;
    vertical-align: middle;
  }
  .info-trigger {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-left: 5px;
    padding: 0;
    border: 1px solid var(--control-border);
    border-radius: 50%;
    color: var(--secondary);
    background: transparent;
    font:
      italic 600 10px/1 Georgia,
      serif;
    cursor: pointer;
  }
  .info-trigger:hover,
  .info-trigger[aria-expanded='true'] {
    color: var(--text);
    background: var(--surface-raised);
  }
  .info-popover {
    position: fixed;
    z-index: 20;
    left: 0;
    top: 0;
    box-sizing: border-box;
    width: min(320px, calc(100vw - 24px));
    padding: 10px 12px;
    border: 1px solid var(--control-border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
    font-size: var(--text-sm);
    font-weight: normal;
    text-align: left;
    white-space: normal;
  }
  .info-popover[hidden] {
    display: none;
  }
  .info-popover.placing {
    visibility: hidden;
  }
</style>
