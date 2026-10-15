<script lang="ts">
  import { onMount, untrack } from 'svelte';
  let {
    isVisible = true,
    source,
  }: {
    isVisible?: boolean;
    /** The session's source; the System and tools section is about Pi sessions only. */
    source: string;
  } = $props();

  let container: HTMLDivElement | null = null;
  let trigger: HTMLButtonElement | null = $state(null);
  let popover: HTMLDivElement | null = $state(null);
  let popoverStyle = $state('');
  let expanded = $state(false);

  $effect(() => {
    if (!isVisible) untrack(() => close(false));
  });
  // Place the popover when it opens and when its content changes with the source.
  $effect(() => {
    void source;
    placePopover();
  });

  function placePopover(): void {
    if (!expanded || !trigger || !popover) return;
    const margin = 12;
    const width = Math.min(480, Math.max(0, window.innerWidth - margin * 2));
    const height = Math.min(popover.scrollHeight, Math.max(0, window.innerHeight - margin * 2));
    const triggerBounds = trigger.getBoundingClientRect();
    const left = Math.max(
      margin,
      Math.min(triggerBounds.right - width, window.innerWidth - width - margin),
    );
    const below = triggerBounds.bottom + 8;
    const top =
      below + height <= window.innerHeight - margin
        ? below
        : Math.max(margin, triggerBounds.top - height - 8);
    popoverStyle = `left:${Math.round(left)}px;top:${Math.round(top)}px;width:${Math.round(width)}px;max-height:${Math.round(height)}px`;
  }

  function close(restoreFocus = true): void {
    if (!expanded) return;
    expanded = false;
    if (restoreFocus) trigger?.focus();
  }

  function toggleHelp(): void {
    if (expanded) close();
    else expanded = true;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (
      event.key === 'Escape' &&
      expanded &&
      event.target instanceof Node &&
      container?.contains(event.target)
    ) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  onMount(() => {
    container?.addEventListener('keydown', handleKeyDown);
    return () => container?.removeEventListener('keydown', handleKeyDown);
  });
</script>

<svelte:window onresize={placePopover} onscroll={placePopover} />

<div class="chart-help" bind:this={container}>
  <button
    bind:this={trigger}
    type="button"
    class="help-trigger"
    aria-label="Chart help"
    aria-expanded={expanded}
    aria-controls="chart-help-popover"
    onclick={toggleHelp}
  >
    Chart help
  </button>
  <div
    id="chart-help-popover"
    class="help-popover"
    bind:this={popover}
    role="group"
    aria-labelledby="chart-help-title"
    aria-hidden={!expanded}
    hidden={!expanded}
    style={popoverStyle}
  >
    <h3 id="chart-help-title">Chart help</h3>
    <h4>Navigate the river</h4>
    <ul>
      <li>Drag across a range to zoom; scroll horizontally or Shift-drag to pan.</li>
      <li>Use pinch or modifier-wheel zoom; ordinary page scrolling remains available.</li>
      <li>
        Use Go to call beside the zoom controls to pin a call without changing zoom. Drag an area to
        zoom to a range.
      </li>
      <li>The lifespan list spans the full session; filter or search it to locate an item.</li>
      <li>Use Find in lifespans from Composition to open and focus a selected item's row.</li>
      <li>Escape closes this help first, then clears the selected item, the pin, and Fit all.</li>
    </ul>
    {#if source === 'pi'}
      <h4>System and tools</h4>
      <p>
        Recorded Pi instructions and tool declarations are replayed into per-call revisions. Their
        token sizes estimate logical context, not exact provider wire framing. Older logs may lack
        this material; missing does not mean zero. Provider-reported input and cost remain
        independent totals.
      </p>
    {/if}
    <h4>Read the scale</h4>
    <p>
      Session scale keeps ribbon heights comparable across calls. Visible calls mode rescales to
      visible columns and interpolated viewport edges, so heights can change while panning or
      zooming. Cached tokens still occupy context capacity.
    </p>
  </div>
</div>

<style>
  .chart-help {
    display: flex;
    align-items: center;
    gap: 6px 12px;
    min-height: 30px;
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .help-trigger {
    cursor: pointer;
    padding: 5px 8px;
    white-space: nowrap;
    border: 1px solid var(--separator);
    border-radius: var(--control-radius);
    color: var(--text);
    background: var(--surface);
    font: inherit;
  }
  .help-trigger:hover {
    background: var(--surface-raised);
  }
  .help-popover {
    position: fixed;
    z-index: 20;
    left: 12px;
    top: 12px;
    width: min(30rem, calc(100vw - 24px));
    max-height: min(70vh, calc(100vh - 24px));
    overflow: auto;
    overscroll-behavior: contain;
    padding: 14px 16px;
    border: 1px solid var(--control-border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    font-size: var(--text-md);
  }
  h3,
  h4 {
    margin: 0 0 6px;
    color: var(--text-strong);
  }
  h3 {
    font-size: var(--text-lg);
  }
  h4 {
    margin-top: 12px;
    font-size: var(--text-sm);
  }
  p {
    margin: 5px 0;
  }
  ul {
    margin: 5px 0;
    padding-left: 20px;
  }
  li + li {
    margin-top: 4px;
  }
</style>
