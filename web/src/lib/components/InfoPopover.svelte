<script lang="ts">
  // A small "i" button beside a value that opens an explanation next to it. It closes on
  // Escape, on a second click, or on a click anywhere else.
  import { tick } from 'svelte';

  export let id: string;
  export let label: string;

  let trigger: HTMLButtonElement | null = null;
  let popover: HTMLDivElement | null = null;
  let popoverStyle = '';
  let expanded = false;
  // Invisible until placed, so it never shows at the browser's default position.
  let placed = false;

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
    <slot />
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
    border: 1px solid #52678c;
    border-radius: 50%;
    color: #aebbd0;
    background: transparent;
    font:
      italic 600 10px/1 Georgia,
      serif;
    cursor: pointer;
  }
  .info-trigger:hover,
  .info-trigger[aria-expanded='true'] {
    color: var(--text);
    background: #1b2942;
  }
  .info-trigger:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .info-popover {
    position: fixed;
    z-index: 20;
    left: 0;
    top: 0;
    box-sizing: border-box;
    width: min(320px, calc(100vw - 24px));
    padding: 10px 12px;
    border: 1px solid #465574;
    border-radius: 8px;
    background: var(--surface);
    color: #d5deed;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
    font-size: 12px;
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
