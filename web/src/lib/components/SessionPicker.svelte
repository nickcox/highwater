<script module lang="ts">
  let nextPicker = 0;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { SessionListItem } from '../api/client';
  import { sessionLabels } from '../session-label';
  import SessionBrowser from './SessionBrowser.svelte';
  import { restore, storageKey, activeFilters, projects, printableKey } from '../session-browser';
  let {
    sessions,
    selectedId,
    onSelect,
  }: { sessions: SessionListItem[]; selectedId: string | null; onSelect: (id: string) => void } =
    $props();
  const id = `session-picker-${nextPicker++}`;
  function readPreferences(): string | null {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }
  let browserState = $state(restore(readPreferences()));
  let browsing = $state(false);
  let sessionButton: HTMLButtonElement;
  const saved = () =>
    JSON.stringify({
      version: 1,
      sort: browserState.sort,
      includeChildren: browserState.includeChildren,
    });
  let lastSaved = saved();
  $effect(() => {
    const next = saved();
    if (next === lastSaved) return;
    lastSaved = next;
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Storage can be unavailable. */
    }
  });
  let unique = $derived([...new Map(sessions.map((s) => [s.id, s])).values()]);
  let selected = $derived(unique.find((s) => s.id === selectedId));
  let labels = $derived(sessionLabels(unique, browserState.harness === 'all'));
  let label = $derived(selected ? labels.get(selected.id)! : 'Choose a session');
  let count = $derived(activeFilters(browserState));
  $effect(() => {
    if (
      unique.length &&
      browserState.project &&
      !projects(unique).some((p) => p.project === browserState.project)
    )
      browserState.project = null;
  });
  function closeBrowser() {
    browsing = false;
    void tick().then(() => sessionButton?.focus());
  }
  function choose(session: SessionListItem) {
    closeBrowser();
    if (session.id !== selectedId) onSelect(session.id);
  }
  function key(event: KeyboardEvent) {
    if (
      (event.isComposing || ['Process', 'Dead', 'Unidentified'].includes(event.key)) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      browsing = true;
      event.stopPropagation();
      return;
    }
    if (printableKey(event)) {
      event.preventDefault();
      browserState.search = event.key;
      browsing = true;
    }
  }
</script>

<div class="picker">
  <button
    class="session-button"
    bind:this={sessionButton}
    data-session-id={selectedId ?? ''}
    aria-label={`Session: ${label}${count ? `, ${count} ${count === 1 ? 'filter' : 'filters'}` : ''}`}
    aria-expanded={browsing}
    aria-controls={`${id}-browser`}
    title={browsing ? 'Hide the session table' : 'Show the session table'}
    onclick={() => {
      if (browsing) closeBrowser();
      else browsing = true;
    }}
    onkeydown={key}
    oncompositionstart={() => (browsing = true)}
    oncompositionend={(event) => {
      if (event.target === sessionButton) browserState.search += event.data;
    }}
  >
    <span class="session-label">{label}</span>{#if count}<span class="filter-count">({count})</span
      >{/if}<span class="session-chevron" aria-hidden="true"></span>
  </button>
  {#if browsing}<SessionBrowser
      sessions={unique}
      bind:browserState
      {selectedId}
      onSelect={choose}
      onClose={closeBrowser}
      id={`${id}-browser`}
    />{/if}
</div>

<style>
  .picker {
    display: grid;
    width: 100%;
    min-width: 0;
    gap: 8px;
  }
  .session-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
    padding: 8px 12px;
    min-height: 36px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--control-border);
    border-radius: var(--control-radius);
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    text-align: left;
  }
  .session-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .filter-count {
    flex: none;
  }
  .session-button:hover,
  .session-button[aria-expanded='true'] {
    background: var(--surface-raised);
  }
  .session-button[aria-expanded='true'] {
    border-color: var(--accent);
  }
  .session-chevron {
    flex: none;
    width: 6px;
    height: 6px;
    margin-top: -3px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg);
    transition: transform 120ms ease;
  }
  .session-button[aria-expanded='true'] .session-chevron {
    margin-top: 3px;
    transform: rotate(-135deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .session-chevron {
      transition: none;
    }
  }
</style>
