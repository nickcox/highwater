<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { ContextItemKind, IndexedAnalysis, PresenceRange } from '../types';
  import { conciseLifespanLabels, displayItemLabel } from '../item-label';
  import { itemColor } from '../context-river/colors';
  import {
    callAxisTicks,
    nearestLifespanCall,
    presenceCount,
    sizeComparisonProfileId,
    sortLifespans,
    tokenTurnExposure,
    type LifespanSortMode,
  } from '../context-river/lifespans';
  import { coverageLabel, exposureLabel, formatInteger } from '../context-river/format';

  const KIND_ORDER: ContextItemKind[] = [
    'assistantMessage',
    'branchSummary',
    'compactionSummary',
    'customMessage',
    'other',
    'system',
    'thinking',
    'toolDefinition',
    'toolResult',
    'unrecordedContext',
    'userMessage',
  ];
  const KIND_LABELS: Record<ContextItemKind, string> = {
    assistantMessage: 'Assistant message',
    branchSummary: 'Branch summary',
    compactionSummary: 'Compaction summary',
    customMessage: 'Custom message',
    other: 'Other',
    system: 'System',
    thinking: 'Thinking',
    toolDefinition: 'Tool definition',
    toolResult: 'Tool result',
    unrecordedContext: 'Unrecorded request context',
    userMessage: 'User message',
  };
  const SEARCH_LIMIT = 120;
  // Rendering every row of a long session adds tens of thousands of elements;
  // show matching rows a page at a time.
  const ROW_PAGE_SIZE = 200;

  export let indexed: IndexedAnalysis;
  export let selectedItemId: string | null = null;
  export let pinnedCallIndex: number | null = null;
  export let onSelectItem: (id: string, callIndex?: number) => void;
  export let onHoverItem: (id: string | null, event?: PointerEvent) => void;
  export let findRequest: { requestId: number; itemId: string } | null = null;

  let searchText = '';
  let selectedKind: ContextItemKind | 'all' = 'all';
  let scope: 'all' | 'presentAtPin' = 'all';
  let scopeStatus = '';
  let sortMode: LifespanSortMode = 'tokenTurns';
  let rowLimit = ROW_PAGE_SIZE;
  let expanded = false;
  let handledFindRequestId = -1;
  let pendingFindItemId: string | null = null;
  let findStatus = '';
  let root: HTMLElement;
  let componentActive = true;
  onDestroy(() => {
    componentActive = false;
  });

  $: allItems = indexed.analysis.contextItems;
  $: conciseLabels = conciseLifespanLabels(allItems);
  $: sizeProfileId = sizeComparisonProfileId(allItems);
  $: sizeProfile =
    sizeProfileId === null
      ? null
      : (indexed.analysis.tokenAnalysis.profiles.find((profile) => profile.id === sizeProfileId) ??
        null);
  $: sizeProfileLabel = sizeProfile
    ? `${sizeProfile.provider}/${sizeProfile.model} · ${sizeProfile.method}`
    : (sizeProfileId ?? 'unavailable');
  $: if (selectedKind !== 'all' && !availableKinds.includes(selectedKind)) selectedKind = 'all';
  $: if (sortMode === 'size' && sizeProfileId === null) sortMode = 'tokenTurns';
  $: if (scope === 'presentAtPin' && pinnedCallIndex === null) {
    scope = 'all';
    scopeStatus = 'Pin cleared; showing all items.';
  }
  $: if (scope === 'all' && pinnedCallIndex !== null) scopeStatus = '';
  $: pinnedCallItemIds =
    pinnedCallIndex === null ? null : (indexed.contextSetByCall.get(pinnedCallIndex) ?? null);
  $: pinnedCallPosition =
    pinnedCallIndex === null || !callPositionByIndex.has(pinnedCallIndex)
      ? null
      : position(pinnedCallIndex);
  $: items = sortLifespans(allItems, sortMode, sizeProfileId);
  $: scopedItems =
    scope === 'presentAtPin' && pinnedCallItemIds !== null
      ? items.filter((item) => pinnedCallItemIds.has(item.id))
      : items;
  $: searchNeedle = searchText.trim().slice(0, SEARCH_LIMIT).toLowerCase();
  $: visibleItems = scopedItems.filter((item) => {
    const kindMatches = selectedKind === 'all' || item.kind === selectedKind;
    const searchMatches =
      searchNeedle.length === 0 ||
      item.label.toLowerCase().includes(searchNeedle) ||
      (item.preview?.text ?? '').toLowerCase().includes(searchNeedle);
    return kindMatches && searchMatches;
  });
  // A new filter or sort starts again from the first page.
  $: (searchNeedle, selectedKind, scope, sortMode, (rowLimit = ROW_PAGE_SIZE));
  $: renderedItems = visibleItems.slice(0, rowLimit);
  $: hiddenRowCount = visibleItems.length - renderedItems.length;
  $: availableKinds = KIND_ORDER.filter((kind) => allItems.some((item) => item.kind === kind));
  $: filtersActive = searchNeedle.length > 0 || selectedKind !== 'all' || scope !== 'all';
  $: callIndices = indexed.analysis.modelCalls.map((call) => call.index);
  $: axisTicks = callAxisTicks(callIndices);
  $: callCount = callIndices.length;
  $: callPositionByIndex = new Map(callIndices.map((callIndex, index) => [callIndex, index]));
  $: selectedItemHidden =
    selectedItemId !== null &&
    filtersActive &&
    !visibleItems.some((item) => item.id === selectedItemId);
  $: if (findRequest && findRequest.requestId !== handledFindRequestId) {
    handledFindRequestId = findRequest.requestId;
    pendingFindItemId = findRequest.itemId;
    findStatus = '';
    expanded = true;
    const requestId = findRequest.requestId;
    void tick().then(() => focusRequestedItem(requestId));
  }
  $: if (!findRequest && pendingFindItemId) {
    pendingFindItemId = null;
    findStatus = '';
  }

  function itemCountLabel(count: number): string {
    return `${formatInteger(count)} item${count === 1 ? '' : 's'}`;
  }

  function position(callIndex: number): number {
    const index = callPositionByIndex.get(callIndex);
    if (index === undefined) return 0;
    return callCount <= 1 ? 50 : (index / (callCount - 1)) * 100;
  }

  function selectSegment(event: MouseEvent, id: string, range: PresenceRange): void {
    // Keyboard and assistive activation are selection-only, like the item label.
    if (event.detail === 0) {
      onSelectItem(id);
      return;
    }
    const track = (event.currentTarget as HTMLElement).closest('.track');
    const bounds = track?.getBoundingClientRect();
    const callIndex =
      bounds && bounds.width > 0
        ? nearestLifespanCall(callIndices, range, (event.clientX - bounds.left) / bounds.width)
        : null;
    if (callIndex === null) onSelectItem(id);
    else onSelectItem(id, callIndex);
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
    return conciseLabels.get(item.id) ?? fullItemLabel(item);
  }

  function fullItemLabel(item: IndexedAnalysis['analysis']['contextItems'][number]): string {
    return displayItemLabel(item, 'Unlabelled item');
  }

  function lifetimeLabel(item: IndexedAnalysis['analysis']['contextItems'][number]): string {
    if (item.presence.length === 0) return 'No model-call presence';
    const ranges = item.presence
      .map((range) =>
        range.startCall === range.endCall
          ? `call ${range.startCall}`
          : `calls ${range.startCall}–${range.endCall}`,
      )
      .join(', ');
    return `Present at ${ranges}`;
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
    const calls =
      callIndices.length === 0
        ? 'this session has no model calls'
        : `from call ${callIndices[0]} to ${callIndices[callIndices.length - 1]}; ticks ${axisTicks.join(', ')}`;
    const pin =
      pinnedCallIndex === null
        ? ''
        : `; solid vertical marker shows pinned call ${pinnedCallIndex}`;
    return `Full-session call axis ${calls}; dashed markers show compaction boundaries${pin}; independent of chart zoom`;
  }

  function clearFilters(): void {
    searchText = '';
    selectedKind = 'all';
    scope = 'all';
    scopeStatus = '';
    findStatus = '';
  }

  function rowId(itemId: string): string {
    return `lifespan-item-${encodeURIComponent(itemId)}`;
  }

  async function focusRequestedItem(requestId = handledFindRequestId): Promise<void> {
    if (!componentActive || requestId !== handledFindRequestId || !pendingFindItemId) return;
    const requestedId = pendingFindItemId;
    const index = visibleItems.findIndex((item) => item.id === requestedId);
    if (index >= rowLimit) {
      rowLimit = Math.ceil((index + 1) / ROW_PAGE_SIZE) * ROW_PAGE_SIZE;
      await tick();
      if (!componentActive || requestId !== handledFindRequestId) return;
    }
    const row = [...(root?.querySelectorAll<HTMLElement>('[data-lifespan-item-id]') ?? [])].find(
      (candidate) => candidate.dataset.lifespanItemId === pendingFindItemId,
    );
    if (row) {
      row.scrollIntoView({ block: 'center' });
      row.focus({ preventScroll: true });
      findStatus = '';
    } else {
      findStatus = 'The selected item is hidden by current lifespan filters.';
      void tick().then(() => {
        const resetButton = root?.querySelector<HTMLButtonElement>('.find-status button');
        resetButton?.scrollIntoView({ block: 'center' });
        resetButton?.focus();
      });
    }
  }

  async function resetFiltersAndFind(): Promise<void> {
    clearFilters();
    await tick();
    await focusRequestedItem();
  }

  function showMoreRows(): void {
    rowLimit += ROW_PAGE_SIZE;
  }
</script>

<section class="lifespans" aria-label="Context lifespans" bind:this={root}>
  <details class="lifespan-disclosure" bind:open={expanded}>
    <summary class="lifespan-header">
      <span class="disclosure-chevron" aria-hidden="true"></span>
      <span class="lifespan-heading">
        <h2>Context lifespans · {itemCountLabel(allItems.length)}</h2>
        <span class="disclosure-action">{expanded ? 'Collapse' : 'Expand'} lifespans</span>
      </span>
      {#if filtersActive}<span class="result-count"
          >{formatInteger(visibleItems.length)} of {formatInteger(allItems.length)} items</span
        >{/if}
    </summary>
    {#if expanded}
      <div class="lifespan-content">
        <div class="browse-controls" role="group" aria-label="Filter and sort context items">
          <label class="search-field" for="lifespan-search">
            <span id="lifespan-search-label">Search items</span>
            <input
              id="lifespan-search"
              aria-labelledby="lifespan-search-label"
              type="search"
              maxlength={SEARCH_LIMIT}
              placeholder="Label or preview"
              bind:value={searchText}
            />
          </label>
          <label class="browse-field kind-field" for="lifespan-kind">
            <span>Kind</span>
            <select id="lifespan-kind" aria-label="Filter by kind" bind:value={selectedKind}>
              <option value="all">All kinds</option>
              {#each availableKinds as kind (kind)}<option value={kind}>{kindLabel(kind)}</option
                >{/each}
            </select>
          </label>
          <label class="browse-field sort-field" for="lifespan-sort">
            <span>Sort by</span>
            <select id="lifespan-sort" aria-label="Sort items" bind:value={sortMode}>
              <option value="tokenTurns">Token-turn exposure</option>
              <option value="size" disabled={sizeProfileId === null}>Size (tokens)</option>
              <option value="firstAppearance">First appearance</option>
              <option value="presenceCount">Lifetime (calls present)</option>
            </select>
          </label>
          <label class="browse-field scope-field" for="lifespan-scope">
            <span>Scope</span>
            <select id="lifespan-scope" aria-label="Scope context items" bind:value={scope}>
              <option value="all">Whole session</option>
              <option value="presentAtPin" disabled={pinnedCallIndex === null}>
                Present at call {pinnedCallIndex ?? '(pin a call first)'}
              </option>
            </select>
          </label>
          {#if filtersActive}<button class="clear-filters" type="button" onclick={clearFilters}
              >Clear filters</button
            >{/if}
        </div>
        <div class="lifespan-scope-status">
          <span
            >Scope: <strong
              >{scope === 'all' ? 'Whole session' : `Present at call ${pinnedCallIndex}`}</strong
            ></span
          >
          {#if pinnedCallIndex !== null}
            <button
              type="button"
              disabled={scope === 'presentAtPin'}
              onclick={() => (scope = 'presentAtPin')}
            >
              Show items present at call {pinnedCallIndex}
            </button>
          {:else}
            <span class="scope-help"
              >Pin a call in Context River to enable call-specific scope.</span
            >
          {/if}
        </div>
        {#if scopeStatus}<p class="scope-status" role="status">{scopeStatus}</p>{/if}
        {#if findStatus}
          <p class="find-status" role="status">
            {findStatus}
            {#if pendingFindItemId && indexed.itemById.has(pendingFindItemId)}
              <button type="button" onclick={resetFiltersAndFind}
                >Reset filters and find item</button
              >
            {/if}
          </p>
        {/if}
        {#if sortMode === 'size'}<p class="sort-help">
            Size uses one shared profile ({sizeProfileLabel}); items without a numeric estimate for
            it sort last.
          </p>{/if}
        {#if selectedItemHidden}<p class="selection-note">
            The selected item is hidden by these filters; its inspector remains available.
          </p>{/if}

        <div class="lifespan-legend" aria-label="Lifespan markers">
          <span><i class="legend-presence"></i>Item presence</span>
          <span><i class="legend-pin"></i>Pinned call</span>
          <span><i class="legend-compaction"></i>Compaction boundary</span>
        </div>

        <div class="axis-row">
          <span class="axis-title">Full-session calls</span>
          <div class="axis-track" role="img" aria-label={axisDescription()}>
            {#if pinnedCallPosition !== null}
              <span
                class="axis-pin-marker"
                style={`left:${pinnedCallPosition}%`}
                aria-hidden="true"
              >
                <span>{pinnedCallIndex}</span>
              </span>
            {/if}
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
          <p class="empty-state">
            No items match these filters. Clear filters to see the full list.
          </p>
        {:else}
          <div class="rows">
            {#each renderedItems as item (item.id)}
              {@const label = itemLabel(item)}
              <div
                id={rowId(item.id)}
                class="row"
                class:selected={selectedItemId === item.id}
                tabindex="-1"
                aria-label={`${fullItemLabel(item)}; ${kindLabel(item.kind)}; ${lifetimeLabel(item)}`}
                data-lifespan-item-id={item.id}
              >
                <div class="label" title={fullItemLabel(item)}>
                  <span class="swatch" style={`background:${itemColor(item.id)}`}></span>
                  <div class="label-copy">
                    <button
                      type="button"
                      class="item-label"
                      class:terminal-item={item.presence.length === 0}
                      aria-label={`Select ${fullItemLabel(item)}${item.presence.length === 0 ? '; no model-call presence' : ''}`}
                      onclick={() => onSelectItem(item.id)}>{label}</button
                    >
                    <small>{kindLabel(item.kind)} · {lifetimeLabel(item)}</small>
                  </div>
                </div>
                <div class="track">
                  {#if pinnedCallPosition !== null}<span
                      class="pin-marker"
                      style={`left:${pinnedCallPosition}%`}
                      aria-hidden="true"
                    ></span>{/if}
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
                      aria-label={`${fullItemLabel(item)}, calls ${range.startCall} through ${range.endCall}`}
                      aria-pressed={selectedItemId === item.id}
                      title={`${label}: calls ${range.startCall}–${range.endCall}`}
                      style={segmentStyle(range, itemColor(item.id))}
                      onpointerenter={(event) => onHoverItem(item.id, event)}
                      onpointermove={(event) => onHoverItem(item.id, event)}
                      onpointerleave={() => onHoverItem(null)}
                      onclick={(event) => selectSegment(event, item.id, range)}
                    ></button>
                  {/each}
                </div>
                <div
                  class="meta"
                  title={`${presenceCount(item)} calls; ${coverageLabel(item.tokenTurnsCoverage.coveredCalls, item.tokenTurnsCoverage.totalCalls)} tokenized`}
                >
                  {exposureLabel(tokenTurnExposure(item), 'calculatedTokens')}
                  {#if item.tokenTurnsCoverage.coveredCalls < item.tokenTurnsCoverage.totalCalls}
                    <small
                      >{coverageLabel(
                        item.tokenTurnsCoverage.coveredCalls,
                        item.tokenTurnsCoverage.totalCalls,
                      )} calls covered</small
                    >
                  {/if}
                </div>
              </div>
            {/each}
          </div>
          {#if hiddenRowCount > 0}
            <div class="more-rows">
              <span
                >Showing {formatInteger(renderedItems.length)} of {itemCountLabel(
                  visibleItems.length,
                )}</span
              >
              <button type="button" onclick={showMoreRows}
                >Show {formatInteger(Math.min(ROW_PAGE_SIZE, hiddenRowCount))} more</button
              >
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </details>
</section>

<style>
  .lifespan-disclosure {
    min-width: 0;
  }
  .lifespan-disclosure > summary {
    list-style: none;
  }
  .lifespan-disclosure > summary::-webkit-details-marker {
    display: none;
  }
  .lifespan-header {
    position: sticky;
    top: 0;
    z-index: 4;
    display: grid;
    grid-template-columns: 14px minmax(0, 1fr) auto;
    justify-content: space-between;
    gap: 8px;
    align-items: start;
    margin: -2px -2px 8px;
    padding: 6px 2px;
    background: var(--surface);
    cursor: pointer;
  }
  .disclosure-chevron {
    width: 9px;
    height: 9px;
    margin: 4px 0 0 2px;
    border-right: 2px solid #c9d7ef;
    border-bottom: 2px solid #c9d7ef;
    transform: rotate(-45deg);
    transition: transform 120ms ease;
  }
  .lifespan-disclosure[open] .disclosure-chevron {
    transform: rotate(45deg);
  }
  .lifespan-heading {
    display: grid;
    min-width: 0;
    gap: 2px;
  }
  .disclosure-action {
    color: var(--secondary);
    font-size: 12px;
  }
  .lifespan-header:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .lifespan-content {
    min-width: 0;
  }
  h2 {
    font-size: 15px;
    margin: 0;
    color: #fff;
  }
  .result-count {
    color: #8f9cb2;
    white-space: nowrap;
  }
  .lifespan-content {
    container: lifespans / inline-size;
  }
  .browse-controls {
    display: grid;
    grid-template-columns:
      minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(150px, 1.1fr) minmax(165px, 1fr)
      auto;
    align-items: end;
    gap: 8px;
    margin: 10px 0 12px;
  }
  .search-field,
  .kind-field,
  .sort-field,
  .scope-field,
  .clear-filters {
    min-width: 0;
  }
  .browse-controls input,
  .browse-controls select {
    box-sizing: border-box;
  }
  .search-field,
  .browse-field {
    display: grid;
    gap: 3px;
    color: var(--secondary);
    font-size: 12px;
  }
  .search-field {
    grid-template-columns: 1fr;
  }
  .browse-controls input,
  .browse-controls select {
    min-width: 0;
    width: 100%;
    background-color: var(--plot);
    border: 1px solid var(--control-border);
    border-radius: 6px;
    color: #eef2f8;
    padding: 7px 8px;
    font: inherit;
    font-size: 12px;
  }
  .browse-controls select {
    padding-right: 32px;
  }
  .browse-controls button {
    white-space: nowrap;
  }
  .sort-help,
  .scope-help,
  .scope-status,
  .selection-note,
  .find-status,
  .more-rows {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
    color: var(--secondary);
    font-size: 12px;
  }
  .empty-state {
    color: #aebbd0;
    font-size: 12px;
    margin: 7px 0;
  }
  .lifespan-scope-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px 12px;
    margin: 6px 0;
    color: var(--secondary);
    font-size: 12px;
  }
  .lifespan-scope-status strong {
    color: #d9e1ef;
  }
  .lifespan-scope-status button,
  .find-status button {
    padding: 4px 7px;
    font-size: 12px;
  }
  .find-status button {
    margin-left: 7px;
  }
  .lifespan-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 7px 0;
    color: var(--secondary);
    font-size: 12px;
  }
  .lifespan-legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .lifespan-legend i {
    display: inline-block;
    width: 15px;
    height: 8px;
  }
  .legend-presence {
    border-radius: 4px;
    background: #728fc5;
  }
  .legend-pin {
    width: 0 !important;
    border-left: 2px solid #f5f7ff;
  }
  .legend-compaction {
    height: 0 !important;
    border-top: 1px dashed #ffb14e;
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
  .axis-pin-marker,
  .pin-marker {
    position: absolute;
    z-index: 3;
    height: 100%;
    border-left: 2px solid #f5f7ff;
    pointer-events: none;
  }
  .axis-pin-marker,
  .pin-marker {
    top: 0;
  }
  .axis-pin-marker span {
    position: absolute;
    top: 0;
    left: 2px;
    padding: 0 2px;
    color: #fff;
    background: #0f1629;
    font-size: 9px;
    white-space: nowrap;
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
    scroll-margin-block: 54px;
    padding: 7px 3px;
    border-top: 1px solid #202b44;
    transition: opacity 120ms ease;
  }
  .row.selected {
    background: #16213a;
    box-shadow: inset 3px 0 #fff;
  }
  .row:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: -2px;
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
  .item-label {
    min-width: 0;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    font: inherit;
  }
  .item-label:hover {
    background: transparent;
    text-decoration: underline;
  }
  .item-label:focus-visible {
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
    background: var(--plot);
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
  @container lifespans (max-width: 900px) {
    .browse-controls {
      grid-template-columns:
        minmax(0, 1.35fr) minmax(115px, 1fr) minmax(145px, 1.1fr) minmax(145px, 1fr)
        auto;
      grid-template-areas:
        'search search kind kind .'
        'sort sort scope scope reset';
    }
    .search-field {
      grid-area: search;
    }
    .kind-field {
      grid-area: kind;
    }
    .sort-field {
      grid-area: sort;
    }
    .scope-field {
      grid-area: scope;
    }
    .clear-filters {
      grid-area: reset;
      justify-self: end;
    }
  }
  @container lifespans (max-width: 680px) {
    .browse-controls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-areas:
        'search search'
        'kind kind'
        'sort scope'
        'reset reset';
    }
    .clear-filters {
      justify-self: start;
    }
  }
  @container lifespans (max-width: 430px) {
    .browse-controls {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        'search'
        'kind'
        'sort'
        'scope'
        'reset';
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
    .row,
    .disclosure-chevron {
      transition: none;
    }
  }
</style>
