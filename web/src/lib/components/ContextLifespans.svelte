<script lang="ts">
  import type { ContextItemKind, IndexedAnalysis, InteractionState, PresenceRange } from '../types';
  import { displayItemLabel } from '../item-label';
  import { itemColor } from '../context-river/colors';
  import {
    callAxisTicks,
    presenceCount,
    sizeComparisonProfileId,
    sortLifespans,
    tokenTurnExposure,
    type LifespanSortMode,
  } from '../context-river/lifespans';
  import { coverageLabel, exposureLabel } from '../context-river/format';

  const KIND_ORDER: ContextItemKind[] = [
    'assistantMessage',
    'branchSummary',
    'compactionSummary',
    'customMessage',
    'other',
    'system',
    'toolDefinition',
    'toolResult',
    'userMessage',
  ];
  const KIND_LABELS: Record<ContextItemKind, string> = {
    assistantMessage: 'Assistant message',
    branchSummary: 'Branch summary',
    compactionSummary: 'Compaction summary',
    customMessage: 'Custom message',
    other: 'Other',
    system: 'System',
    toolDefinition: 'Tool definition',
    toolResult: 'Tool result',
    userMessage: 'User message',
  };
  const SEARCH_LIMIT = 120;

  export let indexed: IndexedAnalysis;
  export let interaction: InteractionState;
  export let selectedItemId: string | null = null;
  export let onSelectItem: (id: string) => void;
  export let onHoverItem: (id: string | null, event?: PointerEvent) => void;

  let searchText = '';
  let selectedKind: ContextItemKind | 'all' = 'all';
  let sortMode: LifespanSortMode = 'tokenTurns';

  $: allItems = indexed.analysis.contextItems;
  $: sizeProfileId = sizeComparisonProfileId(allItems);
  $: sizeProfile =
    sizeProfileId === null
      ? null
      : (indexed.analysis.tokenAnalysis.profiles.find((profile) => profile.id === sizeProfileId) ??
        null);
  $: sizeProfileLabel = sizeProfile
    ? `${sizeProfile.provider}/${sizeProfile.model} · ${sizeProfile.method}`
    : (sizeProfileId ?? 'unavailable');
  $: items = sortLifespans(allItems, sortMode, sizeProfileId);
  $: searchNeedle = searchText.trim().slice(0, SEARCH_LIMIT).toLowerCase();
  $: visibleItems = items.filter((item) => {
    const kindMatches = selectedKind === 'all' || item.kind === selectedKind;
    const searchMatches =
      searchNeedle.length === 0 ||
      item.label.toLowerCase().includes(searchNeedle) ||
      (item.preview?.text ?? '').toLowerCase().includes(searchNeedle);
    return kindMatches && searchMatches;
  });
  $: availableKinds = KIND_ORDER.filter((kind) => allItems.some((item) => item.kind === kind));
  $: filtersActive = searchNeedle.length > 0 || selectedKind !== 'all';
  $: callIndices = indexed.analysis.modelCalls.map((call) => call.index);
  $: axisTicks = callAxisTicks(callIndices);
  $: callCount = callIndices.length;
  $: callPositionByIndex = new Map(callIndices.map((callIndex, index) => [callIndex, index]));
  $: selectedItemHidden =
    selectedItemId !== null &&
    filtersActive &&
    !visibleItems.some((item) => item.id === selectedItemId);

  function position(callIndex: number): number {
    const index = callPositionByIndex.get(callIndex);
    if (index === undefined) return 0;
    return callCount <= 1 ? 50 : (index / (callCount - 1)) * 100;
  }

  function segmentStyle(range: PresenceRange, color: string): string {
    const half = callCount <= 1 ? 8 : Math.min(2.2, 35 / Math.max(1, callCount - 1));
    const left = Math.max(0, position(range.startCall) - half);
    const right = Math.min(100, position(range.endCall) + half);
    return `left:${left}%;width:${Math.max(1, right - left)}%;background-color:${color}`;
  }

  function boundaryPosition(beforeCall: number): number {
    const firstCall = callIndices[0] ?? 1;
    const lastCall = callIndices[callIndices.length - 1] ?? 0;
    if (beforeCall > lastCall) return 100;
    const current = position(beforeCall);
    const previous = position(beforeCall - 1);
    return beforeCall <= firstCall ? Math.max(0, current - 1) : (current + previous) / 2;
  }

  function itemLabel(item: IndexedAnalysis['analysis']['contextItems'][number]): string {
    return displayItemLabel(item, 'Unlabelled item');
  }

  function lifetimeLabel(item: IndexedAnalysis['analysis']['contextItems'][number]): string {
    return item.presence.length === 0
      ? 'No model-call presence'
      : `Calls ${item.firstModelCall}–${item.lastModelCall}`;
  }

  function kindLabel(kind: ContextItemKind): string {
    return KIND_LABELS[kind];
  }

  function isCompactedEnd(itemId: string, range: PresenceRange): boolean {
    return (indexed.compactionBySourceId.get(itemId) ?? []).some(
      (event) => event.beforeModelCall === range.endCall + 1,
    );
  }

  function axisDescription(): string {
    if (callIndices.length === 0) {
      return 'Full-session call axis; this session has no model calls; independent of chart zoom';
    }
    const first = callIndices[0];
    const last = callIndices[callIndices.length - 1];
    return `Full-session call axis from call ${first} to ${last}; ticks ${axisTicks.join(', ')}; dashed markers show compaction boundaries; independent of chart zoom`;
  }

  function clearFilters(): void {
    searchText = '';
    selectedKind = 'all';
  }
</script>

<section class="lifespans" aria-label="Context lifespans">
  <header class="lifespan-header">
    <div>
      <h2>Context lifespans</h2>
      <p>Browse labels and bounded previews; the call axis covers the full session.</p>
    </div>
    <span class="result-count">{visibleItems.length} of {allItems.length} items</span>
  </header>

  <div class="browse-controls" role="group" aria-label="Filter and sort context items">
    <label class="search-field" for="lifespan-search">
      <span id="lifespan-search-label">Search items</span>
      <input
        id="lifespan-search"
        aria-labelledby="lifespan-search-label"
        type="search"
        maxlength={SEARCH_LIMIT}
        placeholder="Label or preview"
        aria-describedby="lifespan-search-help"
        bind:value={searchText}
      />
      <small id="lifespan-search-help">Search labels and bounded previews.</small>
    </label>
    <label class="browse-field" for="lifespan-kind">
      <span>Kind</span>
      <select id="lifespan-kind" aria-label="Filter by kind" bind:value={selectedKind}>
        <option value="all">All kinds</option>
        {#each availableKinds as kind (kind)}<option value={kind}>{kindLabel(kind)}</option>{/each}
      </select>
    </label>
    <label class="browse-field" for="lifespan-sort">
      <span>Sort by</span>
      <select id="lifespan-sort" aria-label="Sort items" bind:value={sortMode}>
        <option value="tokenTurns">Token-turn exposure</option>
        <option value="size" disabled={sizeProfileId === null}>Size (tokens)</option>
        <option value="firstAppearance">First appearance</option>
      </select>
    </label>
    {#if filtersActive}<button type="button" onclick={clearFilters}>Clear filters</button>{/if}
  </div>
  {#if sortMode === 'size'}<p class="sort-help">
      Size uses one shared profile ({sizeProfileLabel}); items without a numeric estimate for it
      sort last.
    </p>{/if}
  {#if selectedItemHidden}<p class="selection-note">
      The selected item is hidden by these filters; its inspector remains available.
    </p>{/if}

  <div class="axis-row">
    <span class="axis-title">Full-session calls</span>
    <div class="axis-track" role="img" aria-label={axisDescription()}>
      {#each axisTicks as callIndex, tickIndex (`tick:${callIndex}`)}
        <span
          class="axis-tick"
          class:first={tickIndex === 0}
          class:last={tickIndex === axisTicks.length - 1}
          class:center={axisTicks.length === 1}
          style={`left:${position(callIndex)}%`}>{callIndex}</span
        >
      {/each}
      {#each indexed.analysis.compactions as compaction (compaction.id)}
        <span
          class="axis-boundary"
          style={`left:${boundaryPosition(compaction.beforeModelCall)}%`}
          aria-hidden="true"
        ></span>
      {/each}
    </div>
    <span class="axis-note">calls</span>
  </div>

  {#if allItems.length === 0}
    <p class="empty-state">No context items in this session.</p>
  {:else if visibleItems.length === 0}
    <p class="empty-state">No items match these filters. Clear filters to see the full list.</p>
  {:else}
    <div class="rows">
      {#each visibleItems as item (item.id)}
        {@const label = itemLabel(item)}
        <div class="row" class:selected={interaction.selectedItemId === item.id}>
          <div class="label" title={label}>
            <span class="swatch" style={`background:${itemColor(item.id)}`}></span>
            <div class="label-copy">
              {#if item.presence.length === 0}
                <button
                  type="button"
                  class="terminal-item"
                  aria-label={`Select ${label}; no model-call presence`}
                  onclick={() => onSelectItem(item.id)}>{label}</button
                >
              {:else}<span class="item-label">{label}</span>{/if}
              <small>{kindLabel(item.kind)} · {lifetimeLabel(item)}</small>
            </div>
          </div>
          <div class="track">
            {#each indexed.analysis.compactions as compaction (compaction.id)}
              <span
                class="boundary"
                style={`left:${boundaryPosition(compaction.beforeModelCall)}%`}
                aria-hidden="true"
              ></span>
            {/each}
            {#each item.presence as range, rangeIndex (`${item.id}:${rangeIndex}`)}
              <button
                type="button"
                class="segment"
                class:compacted={isCompactedEnd(item.id, range)}
                aria-label={`${label}, calls ${range.startCall} through ${range.endCall}`}
                aria-pressed={interaction.selectedItemId === item.id}
                title={`${label}: calls ${range.startCall}–${range.endCall}`}
                style={segmentStyle(range, itemColor(item.id))}
                onpointerenter={(event) => onHoverItem(item.id, event)}
                onpointermove={(event) => onHoverItem(item.id, event)}
                onpointerleave={() => onHoverItem(null)}
                onclick={() => onSelectItem(item.id)}
              ></button>
            {/each}
          </div>
          <div
            class="meta"
            title={`${presenceCount(item)} calls; ${coverageLabel(item.tokenTurnsCoverage.coveredCalls, item.tokenTurnsCoverage.totalCalls)} tokenized`}
          >
            {exposureLabel(tokenTurnExposure(item), 'calculatedTokens')}
            <small
              >{coverageLabel(
                item.tokenTurnsCoverage.coveredCalls,
                item.tokenTurnsCoverage.totalCalls,
              )} calls</small
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .lifespan-header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 15px;
    margin: 0;
    color: #fff;
  }
  .lifespan-header p {
    margin: 3px 0 0;
    color: #8f9cb2;
    font-size: 12px;
  }
  .result-count {
    color: #8f9cb2;
    white-space: nowrap;
  }
  .browse-controls {
    display: grid;
    grid-template-columns: minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(150px, 1.1fr) auto;
    align-items: end;
    gap: 8px;
    margin: 10px 0 12px;
  }
  .search-field,
  .browse-field {
    display: grid;
    gap: 3px;
    color: #aebbd0;
    font-size: 11px;
  }
  .search-field {
    grid-template-columns: 1fr;
  }
  .search-field small {
    color: #8996ad;
  }
  .browse-controls input,
  .browse-controls select {
    min-width: 0;
    width: 100%;
    background: #0b1223;
    border: 1px solid #34415f;
    border-radius: 6px;
    color: #eef2f8;
    padding: 7px 8px;
    font: inherit;
    font-size: 12px;
  }
  .browse-controls button {
    white-space: nowrap;
  }
  .sort-help,
  .selection-note,
  .empty-state {
    color: #aebbd0;
    font-size: 12px;
    margin: 7px 0;
  }
  .axis-row,
  .row {
    display: grid;
    grid-template-columns: minmax(140px, 220px) minmax(0, 1fr) 115px;
    gap: 10px;
    align-items: center;
  }
  .axis-row {
    min-height: 24px;
    margin: 4px 0 2px;
    color: #8f9cb2;
    font-size: 10px;
  }
  .axis-title {
    white-space: nowrap;
  }
  .axis-track {
    height: 22px;
    position: relative;
    min-width: 0;
    border-bottom: 1px solid #34415f;
  }
  .axis-tick {
    position: absolute;
    bottom: 2px;
    transform: translateX(-50%);
    padding: 0 2px;
    background: #0f1629;
    font-variant-numeric: tabular-nums;
  }
  .axis-tick.first {
    transform: none;
  }
  .axis-tick.last {
    transform: translateX(-100%);
  }
  .axis-tick.center {
    transform: translateX(-50%);
  }
  .axis-boundary,
  .boundary {
    position: absolute;
    z-index: 2;
    height: 100%;
    border-left: 1px dashed #ffb14e;
    pointer-events: none;
  }
  .axis-boundary {
    top: 0;
    opacity: 0.75;
  }
  .axis-note {
    text-align: right;
  }
  .row {
    padding: 7px 3px;
    border-top: 1px solid #202b44;
    transition: opacity 120ms ease;
  }
  .row.selected {
    background: #16213a;
    box-shadow: inset 3px 0 #fff;
  }
  .row.selected .segment {
    outline: 2px solid #fff;
    outline-offset: 1px;
  }
  .label {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .swatch {
    flex: 0 0 9px;
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }
  .label-copy {
    display: grid;
    min-width: 0;
  }
  .item-label,
  .terminal-item {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #c9d2e1;
    text-align: left;
  }
  .terminal-item {
    min-width: 0;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    font: inherit;
  }
  .terminal-item:hover {
    background: transparent;
    text-decoration: underline;
  }
  .terminal-item:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 1px;
  }
  .label-copy small {
    overflow: hidden;
    color: #8996ad;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
  }
  .track {
    height: 22px;
    position: relative;
    min-width: 0;
    background: #0b1223;
    border-radius: 5px;
    overflow: hidden;
  }
  .segment {
    position: absolute;
    top: 3px;
    height: 16px;
    min-width: 3px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .segment.compacted {
    border-right: 4px double #fff;
    background-image: repeating-linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.18) 0 3px,
      transparent 3px 7px
    );
  }
  .segment:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 1px;
  }
  .boundary {
    top: 0;
  }
  .meta {
    text-align: right;
    color: #8f9cb2;
    font-size: 12px;
    white-space: nowrap;
  }
  .meta small {
    display: block;
    color: #6f7d95;
    font-size: 10px;
  }
  @media (max-width: 850px) {
    .browse-controls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .search-field {
      grid-column: 1 / -1;
    }
    .browse-controls > button {
      justify-self: end;
    }
  }
  @media (max-width: 700px) {
    .axis-row,
    .row {
      grid-template-columns: 120px minmax(0, 1fr);
    }
    .axis-note,
    .meta {
      display: none;
    }
  }
  @media (max-width: 420px) {
    .browse-controls {
      grid-template-columns: minmax(0, 1fr);
    }
    .browse-controls > * {
      grid-column: auto;
    }
    .result-count {
      white-space: normal;
      text-align: right;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .row {
      transition: none;
    }
  }
</style>
