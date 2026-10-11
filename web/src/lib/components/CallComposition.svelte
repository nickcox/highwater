<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { IndexedAnalysis } from '../types';
  import { itemColor, itemTextColor } from '../context-river/colors';
  import { formatMetric, formatPercent } from '../context-river/format';
  import CopyButton from './CopyButton.svelte';
  import {
    createCompositionProjectionCache,
    fitCompositionLabel,
    layoutCompositionTreemap,
    rankCompositionItems,
    type CallCompositionItem,
    type CompositionScope,
  } from '../composition';

  export let indexed: IndexedAnalysis;
  export let pinnedCallIndex: number | null = null;
  export let selectedItemId: string | null = null;
  export let isVisible = false;
  export let scope: CompositionScope = 'cumulative';
  export let endpointNotice = '';
  export let onScopeChange: ((scope: CompositionScope) => void) | null = null;
  export let onPinCall: (index: number) => void;
  export let onUnpinCall: () => void = () => {};
  export let onSelectItem: (id: string) => void;
  export let onRevealInRiver: (id: string) => void = () => {};
  export let onViewDetails: () => void = () => {};
  export let onFindInLifespans: (id: string) => void = () => {};

  let host: HTMLElement;
  let listElement: HTMLDivElement | null = null;
  let helpDisclosure: HTMLDetailsElement | null = null;
  let width = 800;
  let height = 360;
  let preferredPresentation: 'treemap' | 'list' = 'treemap';
  let activeItemId: string | null = null;
  let lastVisibility = false;
  const projectionCache = createCompositionProjectionCache();

  $: calls = indexed.analysis.modelCalls;
  $: callPosition =
    pinnedCallIndex === null ? -1 : calls.findIndex((call) => call.index === pinnedCallIndex);
  $: call = callPosition < 0 ? null : calls[callPosition];
  $: previousCall = callPosition > 0 ? calls[callPosition - 1] : null;
  $: nextCall =
    callPosition >= 0 && callPosition < calls.length - 1 ? calls[callPosition + 1] : null;
  $: projection = isVisible ? projectionCache.get(indexed, scope, pinnedCallIndex) : null;
  $: rankedItems = projection ? rankCompositionItems(projection.items) : [];
  $: hasPositiveEstimate =
    projection !== null && projection.hasPositiveWeights && !projection.totalOverflow;
  $: treemap =
    projection && hasPositiveEstimate
      ? layoutCompositionTreemap(projection, width, height)
      : { width, height, rectangles: [], groups: [] };
  $: visibleItemIds = new Set(treemap.rectangles.map(({ item }) => item.id));
  $: positiveAreaAvailable = hasPositiveEstimate && treemap.rectangles.length > 0;
  $: effectivePresentation = positiveAreaAvailable ? preferredPresentation : 'list';
  $: navigationItems =
    effectivePresentation === 'treemap'
      ? rankedItems.filter((item) => visibleItemIds.has(item.id))
      : rankedItems;
  $: if (navigationItems.length > 0 && !navigationItems.some((item) => item.id === activeItemId)) {
    activeItemId = navigationItems[0].id;
  }
  $: activeItemIndex = navigationItems.findIndex((item) => item.id === activeItemId);
  $: activeRankedIndex = rankedItems.findIndex((item) => item.id === activeItemId);
  $: activeOptionId = activeRankedIndex < 0 ? undefined : optionId(activeRankedIndex);
  $: selectedItem = selectedItemId ? (indexed.itemById.get(selectedItemId) ?? null) : null;
  $: scopedSelectedItem = projection?.items.find((item) => item.id === selectedItemId) ?? null;
  $: selectedItemPresent = selectedItem !== null && selectedItem.presence.length > 0;
  $: profileDescriptions = (projection?.profileIds ?? []).map((profileId) => {
    const profile = indexed.analysis.tokenAnalysis.profiles.find(
      (candidate) => candidate.id === profileId,
    );
    return {
      id: profileId,
      description: profile
        ? `${profile.provider} / ${profile.model} · ${methodLabel(profile.method)}`
        : 'Tokenization profile unavailable',
    };
  });
  $: methodDescription =
    profileDescriptions.length === 0
      ? 'Token estimate method unavailable'
      : profileDescriptions.length === 1
        ? profileDescriptions[0].description
        : `Mixed profiles across ${formatMetric(profileDescriptions.length)} call profiles`;
  $: scopeHeading =
    scope === 'atCall'
      ? call
        ? `Context composition · Call ${call.index}`
        : 'Context composition · No call selected'
      : projection?.scopeEndCallIndex === null || projection?.scopeEndCallIndex === undefined
        ? 'Cumulative context usage · Whole session'
        : pinnedCallIndex === null
          ? 'Cumulative context usage · Whole session'
          : `Cumulative context usage · Calls ${projection.scopeStartCallIndex}–${projection.scopeEndCallIndex}`;
  $: projectionDescription =
    scope === 'atCall'
      ? `${formatMetric(projection?.items.length ?? 0)} present items`
      : `${formatMetric(projection?.scopeCallCount ?? 0)} model calls included`;
  $: unitLabel = scope === 'atCall' ? 'Estimated tokens' : 'Estimated token-turns';
  $: projectionItemsLabel = scope === 'atCall' ? 'estimated item tokens' : 'estimated token-turns';
  $: coverageIsPartial =
    (projection?.missingItemCallCount ?? 0) > 0 ||
    (projection?.partialItemCallCount ?? 0) > 0 ||
    (projection?.unavailableCoverageItemCallCount ?? 0) > 0;
  $: numericAppearanceCount = projection?.numericItemCallCount ?? 0;
  $: totalAppearanceCount = projection?.totalItemCallCount ?? 0;
  $: zeroItemCount = projection?.items.filter((item) => item.tokens === 0).length ?? 0;
  $: unavailableItemCount =
    projection?.items.filter((item) => item.tokens === null && !item.overflowed).length ?? 0;
  $: overflowItemCount = projection?.items.filter((item) => item.overflowed).length ?? 0;
  $: positiveItemCount = projection?.items.filter((item) => (item.tokens ?? 0) > 0).length ?? 0;
  $: renderedPositiveItemCount = treemap.rectangles.length;
  $: tinyPositiveItemCount = Math.max(0, positiveItemCount - renderedPositiveItemCount);

  function optionId(index: number): string {
    return `composition-option-${scope}-${pinnedCallIndex ?? 'whole'}-${index}`;
  }

  function tileClipId(index: number): string {
    return `composition-tile-clip-${scope}-${pinnedCallIndex ?? 'whole'}-${index}`;
  }

  function methodLabel(method: CallCompositionItem['estimateMethod']): string {
    switch (method) {
      case 'modelTokenizer':
        return 'Model tokenizer';
      case 'apiSerializationEstimate':
        return 'Estimated API serialization';
      case 'characterHeuristic':
        return 'Character heuristic';
      case 'reportedUsage':
        return 'Reported thinking size';
      default:
        return 'Mixed or unavailable estimate method';
    }
  }

  function itemOptionLabel(item: CallCompositionItem): string {
    const estimate =
      item.tokens === null
        ? item.overflowed
          ? 'safe subtotal unavailable because the sum overflowed'
          : 'token estimate unavailable'
        : `${formatMetric(item.tokens)} estimated ${scope === 'atCall' ? 'tokens' : 'token-turns'}`;
    const share =
      item.share === null
        ? ''
        : `${formatPercent(item.share)} of ${coverageIsPartial ? 'available-estimate subset' : 'numeric item estimates'}`;
    const method =
      item.estimateMethods.length > 1 ? 'mixed estimate methods' : methodLabel(item.estimateMethod);
    const coverage = `estimate coverage ${item.estimateCoverage}`;
    const contributionCoverage =
      scope === 'cumulative'
        ? `${item.knownContributionCount} of ${item.scopePresenceCount} item-call contributions have numeric estimates; ${item.missingContributionCount} unavailable`
        : '';
    const explanations = item.explanations
      .map((explanation) => `${explanation.title}: ${explanation.impact}`)
      .join('; ');
    const age =
      item.ageAtCall === null
        ? 'age unavailable'
        : `age ${item.ageAtCall} calls at the ${scope === 'atCall' ? 'inspected call' : 'scope endpoint'}`;
    return `${item.label}, ${item.kindLabel}, ${estimate}, ${method}, ${coverage}${share ? `, ${share}` : ''}${contributionCoverage ? `, ${contributionCoverage}` : ''}${explanations ? `, ${explanations}` : ''}, ${age}`;
  }

  function selectItem(item: CallCompositionItem): void {
    activeItemId = item.id;
    onSelectItem(item.id);
  }

  async function keepActiveListItemVisible(): Promise<void> {
    await tick();
    if (effectivePresentation !== 'list' || !listElement || !activeOptionId) return;
    const activeOption = document.getElementById(activeOptionId);
    if (!activeOption || !listElement.contains(activeOption)) return;
    const viewport = listElement.getBoundingClientRect();
    const option = activeOption.getBoundingClientRect();
    if (option.top < viewport.top) listElement.scrollTop += option.top - viewport.top;
    else if (option.bottom > viewport.bottom)
      listElement.scrollTop += option.bottom - viewport.bottom;
  }

  function handleListKeydown(event: KeyboardEvent): void {
    if (navigationItems.length === 0) return;
    let nextIndex = activeItemIndex < 0 ? 0 : activeItemIndex;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = Math.min(navigationItems.length - 1, nextIndex + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, nextIndex - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = navigationItems.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      const active = navigationItems[nextIndex];
      if (active) selectItem(active);
      event.preventDefault();
      return;
    } else {
      return;
    }
    event.preventDefault();
    activeItemId = navigationItems[nextIndex]?.id ?? null;
    void keepActiveListItemVisible();
  }

  function setPresentation(mode: 'treemap' | 'list'): void {
    preferredPresentation = mode;
  }

  function setScope(nextScope: CompositionScope): void {
    if (scope === nextScope) return;
    scope = nextScope;
    onScopeChange?.(nextScope);
  }

  function closeHelpOnEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !helpDisclosure?.open) return;
    event.preventDefault();
    event.stopPropagation();
    helpDisclosure.open = false;
    helpDisclosure.querySelector('summary')?.focus();
  }

  function tokenValue(item: CallCompositionItem): string {
    if (item.tokens === null)
      return item.overflowed ? 'Subtotal exceeds safe range' : 'Unavailable';
    return `${formatMetric(item.tokens)} ${scope === 'atCall' ? 'estimated tokens' : 'estimated token-turns'}`;
  }

  function shareLabel(item: CallCompositionItem): string {
    if (item.share === null) return 'Share unavailable';
    return `${formatPercent(item.share)} of ${coverageIsPartial ? 'available-estimate subset' : 'numeric estimates'}`;
  }

  function coverageHeadline(): string {
    if (!projection || totalAppearanceCount === 0) return 'No item appearances are in this scope';
    if (numericAppearanceCount === totalAppearanceCount) {
      return 'Numeric estimates available for all item appearances in this scope';
    }
    return `Numeric estimates available for ${formatMetric(numericAppearanceCount)} of ${formatMetric(totalAppearanceCount)} item appearances in this scope`;
  }

  function omissionDescription(): string {
    const reasons: string[] = [];
    if (zeroItemCount > 0) reasons.push(`${formatMetric(zeroItemCount)} zero-valued items`);
    if (unavailableItemCount > 0)
      reasons.push(`${formatMetric(unavailableItemCount)} unavailable estimates`);
    if (overflowItemCount > 0)
      reasons.push(`${formatMetric(overflowItemCount)} overflowed subtotals`);
    if (tinyPositiveItemCount > 0)
      reasons.push(
        `${formatMetric(tinyPositiveItemCount)} positive items too small to render at this layout size`,
      );
    return reasons.join('; ');
  }

  function compositionStatus(): string {
    if (!projection) return '';
    const caveats: string[] = [];
    if (projection.totalOverflow)
      caveats.push('The safe integer range was exceeded; shares and areas are withheld.');
    if (projection.missingItemCallCount > 0) {
      caveats.push(
        `${formatMetric(projection.missingItemCallCount)} of ${formatMetric(projection.totalItemCallCount)} item-call contributions have no numeric estimate; subtotals and shares use the available-estimate subset.`,
      );
    }
    if (projection.partialItemCallCount > 0) {
      caveats.push(
        `${formatMetric(projection.partialItemCallCount)} item-call estimates have partial payload coverage; subtotals remain qualified.`,
      );
    }
    if (projection.unavailableCoverageItemCallCount > 0) {
      caveats.push(
        `${formatMetric(projection.unavailableCoverageItemCallCount)} item-call estimates have unavailable semantic coverage; any numeric contributions remain usable but qualified.`,
      );
    }
    return caveats.join(' ');
  }

  function measure(): void {
    if (!host || !isVisible) return;
    const nextWidth = host.clientWidth;
    if (nextWidth > 0 && Math.abs(nextWidth - width) > 0.5) width = nextWidth;
  }

  $: if (lastVisibility !== isVisible) {
    lastVisibility = isVisible;
    if (isVisible) measure();
  }

  onMount(() => {
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            const nextWidth = entries[0]?.contentRect.width;
            if (isVisible && nextWidth && Math.abs(nextWidth - width) > 0.5) width = nextWidth;
          });
    observer?.observe(host);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  });
</script>

<section class="composition" aria-label="Context composition" bind:this={host}>
  {#if calls.length > 0}
    <div class="composition-controls">
      <div class="scope-controls" role="group" aria-label="Composition scope">
        <button type="button" aria-pressed={scope === 'atCall'} onclick={() => setScope('atCall')}
          >At call</button
        >
        <button
          type="button"
          aria-pressed={scope === 'cumulative'}
          onclick={() => setScope('cumulative')}>Cumulative</button
        >
      </div>
      {#if projection && (scope === 'atCall' ? call !== null : true)}
        <div class="presentation-controls" role="group" aria-label="Composition presentation">
          <button
            type="button"
            aria-pressed={preferredPresentation === 'treemap'}
            onclick={() => setPresentation('treemap')}>Treemap</button
          >
          <button
            type="button"
            aria-pressed={preferredPresentation === 'list'}
            onclick={() => setPresentation('list')}>List</button
          >
        </div>
      {/if}
    </div>
  {/if}

  {#if calls.length === 0}
    <div class="empty-state">
      <h3>No model-call usage</h3>
      <p>This session has no model calls. Terminal items remain available in Context lifespans.</p>
    </div>
  {:else if scope === 'atCall' && !call}
    <div class="empty-state">
      <p>Pin a call to inspect its item estimates.</p>
      <button type="button" onclick={() => onPinCall(calls[calls.length - 1].index)}>
        Inspect latest call
      </button>
    </div>
  {:else if !projection}
    <div class="empty-state"><p>Preparing composition…</p></div>
  {:else}
    {#if endpointNotice && scope === 'cumulative' && pinnedCallIndex === null}
      <p class="endpoint-status" role="status">{endpointNotice}</p>
    {/if}
    <header class="composition-header">
      <div class="scope-title">
        <h3>{scopeHeading}</h3>
        <p>{unitLabel} · {projectionDescription} · {methodDescription}</p>
      </div>
      {#if pinnedCallIndex !== null}
        <div class="endpoint-actions">
          <div class="call-stepper" role="group" aria-label="Inspect adjacent calls">
            <button
              type="button"
              aria-label="Inspect previous call"
              disabled={previousCall === null}
              onclick={() => previousCall && onPinCall(previousCall.index)}>Previous call</button
            >
            <button
              type="button"
              aria-label="Inspect next call"
              disabled={nextCall === null}
              onclick={() => nextCall && onPinCall(nextCall.index)}>Next call</button
            >
          </div>
          {#if scope === 'cumulative'}
            <button type="button" onclick={onUnpinCall}>Whole session</button>
          {/if}
        </div>
      {/if}
    </header>

    {#if scope === 'cumulative' && profileDescriptions.length > 0}
      <details class="profile-diagnostics">
        <summary>Profile details</summary>
        <ul>
          {#each profileDescriptions as profile (profile.id)}
            <li>
              {profile.description} · <code>{profile.id}</code>
              <CopyButton value={profile.id} label="profile ID" />
            </li>
          {/each}
        </ul>
      </details>
    {:else if scope === 'atCall' && call?.tokenizationProfileId}
      <details class="profile-diagnostics">
        <summary>Profile details</summary>
        <p>
          <code>{call.tokenizationProfileId}</code>
          <CopyButton value={call.tokenizationProfileId} label="profile ID" />
        </p>
      </details>
    {/if}

    <p class="coverage-headline">{coverageHeadline()}</p>
    <div class="composition-totals" aria-label="Composition totals and coverage">
      <strong>{formatMetric(projection.measuredTokenTotal)} {projectionItemsLabel}</strong>
      <span>
        {formatMetric(projection.items.length)} items
        {#if projection.unmeasuredItemCount > 0}
          · {formatMetric(projection.measuredItemCount)} with numeric estimates
        {/if}
      </span>
      {#if coverageIsPartial}<span>Available-estimate subset</span>{/if}
      {#if projection.unmeasuredItemCount > 0}<span
          >{formatMetric(projection.unmeasuredItemCount)} items unavailable</span
        >{/if}
    </div>
    <details class="coverage-details">
      <summary>Exact coverage counts</summary>
      <p>
        {formatMetric(numericAppearanceCount)} of {formatMetric(totalAppearanceCount)} item appearances
        have numeric estimates in this {scope === 'atCall' ? 'call' : 'cumulative scope'}.
        {formatMetric(projection.missingItemCallCount)} are missing, {formatMetric(
          projection.partialItemCallCount,
        )} have partial payload coverage, and {formatMetric(
          projection.unavailableCoverageItemCallCount,
        )} have unavailable semantic coverage.
      </p>
    </details>
    {#if compositionStatus()}<p class="coverage-status" role="status">{compositionStatus()}</p>{/if}
    {#if projection.allMeasuredZero}
      <p class="coverage-status">
        All numeric item estimates are zero; no equal-area rectangles are substituted.
      </p>
    {:else if projection.measuredItemCount === 0}
      <p class="coverage-status">
        No numeric item estimates are available in this scope; showing the complete List.
      </p>
    {/if}

    <details class="composition-help" bind:this={helpDisclosure}>
      <summary onkeydown={closeHelpOnEscape}>Composition help</summary>
      <div class="help-content">
        <p>
          {#if scope === 'cumulative'}
            Token-turns count an item's estimated tokens each time it appears in a model call. This
            is input-context exposure, not unique content, provider usage, billed tokens, or cost.
          {:else}
            Areas use only this call's applicable item estimates. Shares use the numeric-estimate
            subset; unknown estimates are not inferred from provider totals.
          {/if}
        </p>
        <p>
          Areas are approximate because kind-group gutters reduce their space. Zero and unavailable
          values are never enlarged. Item colors are stable identity cues shared with River, not
          cache or cost states; labels, group boundaries, and selection also carry meaning.
        </p>
        <p>
          Select a tile or use List to inspect an item; use River zoom/select to investigate its
          call placement, and search or filter lifespans to compare persistence.
        </p>
      </div>
    </details>

    {#if effectivePresentation === 'treemap'}
      {#if treemap.rectangles.length < projection.items.length}
        <p class="omission-note" role="status">
          Treemap shows {formatMetric(treemap.rectangles.length)} of {formatMetric(
            projection.items.length,
          )} items. {omissionDescription()}.
          <button type="button" onclick={() => setPresentation('list')}>View all in List</button>
        </p>
      {/if}
      <div class="treemap-frame">
        <svg
          class="composition-treemap"
          width={treemap.width}
          {height}
          viewBox={`0 0 ${treemap.width} ${height}`}
          role="listbox"
          aria-label={`${scopeHeading} treemap; ${treemap.rectangles.length} visible tiles of ${projection.items.length} items; use arrow keys to inspect`}
          aria-activedescendant={activeOptionId}
          tabindex="0"
          onkeydown={handleListKeydown}
        >
          <defs>
            {#each treemap.groups as group (group.kind)}
              <clipPath id={`composition-group-clip-${group.kind}`}>
                <rect
                  x={group.x + 3}
                  y={group.y + 1}
                  width={Math.max(0, group.width - 6)}
                  height={13}
                />
              </clipPath>
            {/each}
            {#each treemap.rectangles as rectangle (rectangle.item.id)}
              <clipPath id={tileClipId(rectangle.optionIndex)}>
                <rect
                  x={rectangle.x + 4}
                  y={rectangle.y + 3}
                  width={Math.max(0, rectangle.width - 8)}
                  height={Math.max(0, rectangle.height - 6)}
                />
              </clipPath>
            {/each}
          </defs>
          {#each treemap.groups as group (group.kind)}
            <g class="kind-group" aria-label={`${group.label} group`}>
              <title>{group.label}</title>
              <rect x={group.x} y={group.y} width={group.width} height={group.height} />
              {#if group.labelText}
                <text
                  x={group.x + 5}
                  y={group.y + 11}
                  clip-path={`url(#composition-group-clip-${group.kind})`}>{group.labelText}</text
                >
              {/if}
            </g>
          {/each}
          {#each treemap.rectangles as rectangle (rectangle.item.id)}
            <g
              id={optionId(rectangle.optionIndex)}
              class:selected={selectedItemId === rectangle.item.id}
              class:active={activeItemId === rectangle.item.id}
              role="option"
              aria-selected={selectedItemId === rectangle.item.id}
              aria-label={itemOptionLabel(rectangle.item)}
              data-composition-item={rectangle.item.id}
              tabindex="-1"
              onpointerup={() => selectItem(rectangle.item)}
            >
              <title>{itemOptionLabel(rectangle.item)}</title>
              <rect
                x={rectangle.x}
                y={rectangle.y}
                width={rectangle.width}
                height={rectangle.height}
                fill={itemColor(rectangle.item.id)}
                fill-opacity="1"
                class:partial={rectangle.item.estimateCoverage !== 'complete'}
              />
              {#if rectangle.labelFits && rectangle.labelText}
                <g clip-path={`url(#${tileClipId(rectangle.optionIndex)})`} aria-hidden="true">
                  <text
                    style:fill={itemTextColor(rectangle.item.id)}
                    x={rectangle.x + 5}
                    y={rectangle.y + 16}>{rectangle.labelText}</text
                  >
                  {#if rectangle.height >= 49}
                    <text
                      style:fill={itemTextColor(rectangle.item.id)}
                      class="tile-value"
                      x={rectangle.x + 5}
                      y={rectangle.y + 31}
                    >
                      {formatMetric(rectangle.item.tokens)}{rectangle.item.share === null
                        ? ''
                        : ` · ${formatPercent(rectangle.item.share)}`}
                    </text>
                  {/if}
                </g>
              {/if}
            </g>
          {/each}
        </svg>
      </div>
    {:else}
      <div
        class="composition-list"
        role="listbox"
        aria-label={`${scopeHeading} items ranked by estimated contribution; ${rankedItems.length} items`}
        aria-activedescendant={activeOptionId}
        tabindex="0"
        bind:this={listElement}
        onkeydown={handleListKeydown}
      >
        {#each rankedItems as item, index (item.id)}
          <div
            id={optionId(index)}
            class="composition-row"
            class:selected={selectedItemId === item.id}
            class:active={activeItemId === item.id}
            class:unavailable={item.tokens === null}
            role="option"
            aria-selected={selectedItemId === item.id}
            aria-label={itemOptionLabel(item)}
            data-composition-item={item.id}
            tabindex="-1"
            onpointerup={() => selectItem(item)}
          >
            <span class="kind-mark" style={`background:${itemColor(item.id)}`} aria-hidden="true"
            ></span>
            <span class="row-label">
              <b>{item.label}</b>
              <small>
                {item.kindLabel} · {item.estimateMethods.length > 1
                  ? 'Mixed estimate methods'
                  : methodLabel(item.estimateMethod)} · {item.estimateCoverage} estimate coverage
              </small>
              {#if scope === 'cumulative'}
                <small
                  >{formatMetric(item.knownContributionCount)} of {formatMetric(
                    item.scopePresenceCount,
                  )} item-call contributions numeric · {formatMetric(item.missingContributionCount)} unavailable</small
                >
              {/if}
              {#if item.missingContributionCount > 0 || item.partialEstimateContributionCount > 0 || item.unavailableCoverageContributionCount > 0}<small
                  >Known subtotal only; {formatMetric(item.missingContributionCount)} missing,
                  {formatMetric(item.partialEstimateContributionCount)} partial-coverage, and
                  {formatMetric(item.unavailableCoverageContributionCount)} unavailable-semantic contributions.</small
                >{/if}
              {#each item.explanations as explanation (explanation.title)}
                <small>{explanation.title}: {explanation.impact}</small>
              {/each}
            </span>
            <span class="row-measures">
              <b>{tokenValue(item)}</b>
              <small>{shareLabel(item)}</small>
              <small>
                {item.ageAtCall === null
                  ? 'Age unavailable'
                  : `${item.ageAtCall} calls old at ${scope === 'atCall' ? 'this call' : 'scope endpoint'}`}
              </small>
            </span>
          </div>
        {/each}
      </div>
    {/if}

    {#if selectedItemId && selectedItem}
      <section class="selected-composition-item" aria-label="Selected item in Composition">
        <div class="selected-summary-copy">
          <strong>{selectedItem.label}</strong>
          {#if scopedSelectedItem}
            <span>{tokenValue(scopedSelectedItem)} · {shareLabel(scopedSelectedItem)}</span>
            {#if scopedSelectedItem.missingContributionCount > 0 || scopedSelectedItem.partialEstimateContributionCount > 0 || scopedSelectedItem.unavailableCoverageContributionCount > 0}
              <small
                >Known subtotal; {formatMetric(scopedSelectedItem.missingContributionCount)} item-call
                estimates unavailable, {formatMetric(
                  scopedSelectedItem.partialEstimateContributionCount,
                )} partial-coverage, and {formatMetric(
                  scopedSelectedItem.unavailableCoverageContributionCount,
                )} unavailable-semantic.</small
              >
            {/if}
          {:else}
            <span>
              {scope === 'atCall'
                ? `Not present at call ${call?.index ?? 'Unknown'}.`
                : 'No contribution within this cumulative scope.'}
            </span>
          {/if}
        </div>
        <div class="selected-item-actions">
          <button type="button" onclick={onViewDetails}>View details</button>
          <button type="button" onclick={() => onFindInLifespans(selectedItem.id)}
            >Find in lifespans</button
          >
          {#if selectedItemPresent}
            <button type="button" onclick={() => onRevealInRiver(selectedItem.id)}
              >Reveal in River</button
            >
          {/if}
        </div>
      </section>
    {/if}

    {#if scope === 'atCall' && call}
      <details class="reconciliation">
        <summary>Compare with provider usage</summary>
        <p>
          Comparison is informational; it does not validate request overhead or change composition
          areas.
        </p>
        <dl>
          <div>
            <dt>Provider prompt</dt>
            <dd>{formatMetric(call.reportedPromptTokens)} tokens</dd>
          </div>
          <div>
            <dt>Calculated visible context</dt>
            <dd>{formatMetric(call.tokenAnalysis.calculatedVisibleTokens)} tokens</dd>
          </div>
          <div>
            <dt>Known request framing</dt>
            <dd>{formatMetric(call.tokenAnalysis.knownFramingOverheadTokens)} tokens</dd>
          </div>
          <div>
            <dt>Difference</dt>
            <dd>
              {call.tokenAnalysis.residualTokens === null
                ? 'Unknown'
                : `${formatMetric(call.tokenAnalysis.residualTokens)} tokens`}
            </dd>
          </div>
        </dl>
      </details>
    {/if}
  {/if}
</section>

<style>
  .composition {
    min-width: 0;
  }
  .composition-controls,
  .scope-controls,
  .presentation-controls,
  .composition-header,
  .endpoint-actions,
  .call-stepper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .composition-controls {
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 10px;
  }
  .scope-controls button[aria-pressed='true'],
  .presentation-controls button[aria-pressed='true'] {
    border-color: #829fd2;
    background: #26385d;
    color: #fff;
  }
  .composition-header {
    justify-content: space-between;
    margin: 8px 0;
  }
  .endpoint-status {
    margin: 6px 0;
    color: #ffd28d;
    font-size: 12px;
  }
  .scope-title {
    min-width: 0;
  }
  h3 {
    margin: 0;
    color: #f4f6fb;
    font-size: 15px;
  }
  .composition-header p,
  .empty-state p {
    margin: 3px 0 0;
    color: #aebbd0;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .endpoint-actions {
    justify-content: flex-end;
  }
  .composition-totals {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 14px;
    color: #d5deed;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .composition-totals strong {
    color: #f2f5fb;
  }
  .coverage-headline,
  .coverage-status,
  .omission-note {
    margin: 6px 0;
    color: #ffcf87;
    font-size: 12px;
  }
  .coverage-headline {
    color: #e5ecfa;
    font-weight: 650;
  }
  .coverage-details {
    margin: 6px 0;
    color: #aebbd0;
    font-size: 12px;
  }
  .coverage-details p {
    max-width: 75ch;
    margin: 5px 0;
  }
  .omission-note button {
    margin-left: 7px;
    padding: 3px 7px;
    font-size: 11px;
  }
  .composition-help,
  .profile-diagnostics,
  .reconciliation {
    margin: 8px 0;
    color: #aebbd0;
    font-size: 12px;
  }
  summary {
    width: fit-content;
    color: #c8d5ed;
    cursor: pointer;
  }
  summary:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 3px;
    border-radius: 2px;
  }
  .help-content {
    max-width: 75ch;
    padding: 4px 0 0 12px;
  }
  .help-content p,
  .reconciliation p,
  .profile-diagnostics p {
    margin: 5px 0;
  }
  .profile-diagnostics ul {
    display: grid;
    gap: 5px;
    padding-left: 20px;
    overflow-wrap: anywhere;
  }
  .profile-diagnostics code {
    overflow-wrap: anywhere;
  }
  .reconciliation dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
    margin: 7px 0 0;
  }
  dt {
    color: #8996ad;
    font-size: 10px;
  }
  dd {
    margin: 2px 0 0;
    color: #e1e7f2;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .treemap-frame {
    width: 100%;
    overflow: auto;
    border: 1px solid #34415f;
    border-radius: 8px;
    background: var(--plot);
  }
  .composition-treemap {
    display: block;
    max-width: 100%;
    background: var(--plot);
  }
  .composition-treemap:focus-visible,
  .composition-list:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .kind-group rect {
    fill: none;
    stroke: #d1daeb;
    stroke-opacity: 0.52;
    stroke-width: 1;
    pointer-events: none;
  }
  .kind-group text {
    fill: #f4f6fb;
    font-size: 9px;
    font-weight: 600;
    pointer-events: none;
  }
  .composition-treemap g[role='option'] {
    cursor: pointer;
  }
  .composition-treemap g[role='option'] rect {
    stroke: var(--plot);
    stroke-width: 1;
  }
  .composition-treemap:focus g[role='option'].active rect {
    stroke: #9fc0ff;
    stroke-width: 2;
  }
  .composition-treemap g[role='option'].selected rect {
    stroke: #fff;
    stroke-width: 2;
  }
  .composition-treemap g[role='option'] rect.partial {
    stroke: #ffcb74;
    stroke-dasharray: 3 2;
  }
  .composition-treemap g[role='option'] text {
    fill: #fff;
    font-size: 10px;
    pointer-events: none;
  }
  .composition-treemap g[role='option'] text.tile-value {
    fill: #e0e8f5;
    font-size: 9px;
  }
  .composition-list {
    display: grid;
    gap: 3px;
    max-height: 390px;
    overflow: auto;
    padding: 3px;
    border: 1px solid #34415f;
    border-radius: 8px;
    background: var(--plot);
    overscroll-behavior: contain;
  }
  .composition-row {
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr) minmax(130px, 0.55fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 7px;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
  }
  .composition-list:focus .composition-row.active {
    border-color: #9fc0ff;
    background: #1a2741;
  }
  .composition-row.selected {
    border-color: #fff;
    background: var(--action);
  }
  .composition-row.unavailable {
    color: #aebbd0;
  }
  .kind-mark {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }
  .row-label,
  .row-measures {
    display: grid;
    min-width: 0;
    gap: 2px;
  }
  .row-label b {
    overflow-wrap: anywhere;
    color: #e7edf8;
    font-size: 12px;
  }
  .row-label small,
  .row-measures small {
    color: #9aa8bf;
    font-size: 10px;
    overflow-wrap: anywhere;
  }
  .row-measures {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .row-measures b {
    color: #fff;
    font-size: 12px;
  }
  .selected-composition-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 14px;
    min-height: 46px;
    margin-top: 9px;
    padding: 7px 9px;
    border: 1px solid #34415f;
    border-radius: 7px;
    background: #0b1223;
  }
  .selected-summary-copy {
    display: grid;
    min-width: 0;
    gap: 2px;
  }
  .selected-summary-copy strong,
  .selected-summary-copy span,
  .selected-summary-copy small {
    overflow-wrap: anywhere;
  }
  .selected-summary-copy strong {
    color: #f1f4fa;
    font-size: 12px;
  }
  .selected-summary-copy span,
  .selected-summary-copy small {
    color: #aebbd0;
    font-size: 11px;
  }
  .selected-item-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .selected-item-actions button {
    padding: 5px 7px;
    font-size: 11px;
  }
  .empty-state {
    padding: 12px;
    border: 1px solid #293651;
    border-radius: 8px;
    background: #0b1223;
  }
  @media (max-width: 650px) {
    .reconciliation dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .composition-header {
      align-items: flex-start;
    }
  }
  @media (max-width: 440px) {
    .composition-row {
      grid-template-columns: 10px minmax(0, 1fr);
    }
    .row-measures {
      grid-column: 2;
      text-align: left;
    }
  }
</style>
