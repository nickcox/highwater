<script lang="ts">
  import type { Snippet } from 'svelte';

  // A disclosure for controls that do not fit a narrow view. Escape closes it through the
  // session view's `.view-options` handling; a pointer press outside it also closes it.
  let { label, children }: { label: string; children: Snippet } = $props();
  let open = $state(false);
  let menu: HTMLDetailsElement;

  $effect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!event.composedPath().includes(menu)) open = false;
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  });
</script>

<details class="view-options compact-menu" bind:this={menu} bind:open>
  <summary>{label}</summary>
  <div class="menu-panel" role="group" aria-label={label}>
    {@render children()}
  </div>
</details>

<style>
  .compact-menu {
    position: relative;
  }
  summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--control-size);
    padding: var(--toggle-padding);
    border: 1px solid var(--separator);
    border-radius: var(--control-radius);
    background: var(--surface);
    color: var(--text);
    list-style: none;
    white-space: nowrap;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: '';
    width: 0;
    height: 0;
    border-top: 5px solid currentColor;
    border-right: 4px solid transparent;
    border-left: 4px solid transparent;
  }
  .compact-menu[open] > summary {
    border-color: var(--accent);
  }
  .menu-panel {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 6;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    width: max-content;
    max-width: min(320px, calc(100cqw - 24px));
    padding: 10px;
    border: 1px solid var(--separator);
    border-radius: var(--radius);
    background: var(--surface-raised);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.18);
  }
</style>
