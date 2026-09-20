<script lang="ts">
  import { onMount } from 'svelte';
  import type { IndexedAnalysis, InteractionState } from '../types';
  import { itemColor } from './colors';
  import { clientXToViewBox, nearestCallIndex } from './hit-testing';
  import { layoutContextRiver } from './layout';
  import { relatedItemIds } from './lineage';

  export let indexed: IndexedAnalysis;
  export let interaction: InteractionState;
  export let onHoverCall: (index: number | null) => void;
  export let onPinCall: (index: number) => void;
  export let onHoverItem: (id: string | null) => void;
  export let onSelectItem: (id: string) => void;
  export let onEmptyClick: (index: number) => void;
  export let onEscape: () => void;

  let host: HTMLDivElement;
  let svg: SVGSVGElement;
  let observedWidth = 960;
  const height = 500;
  const margin = { top: 36, right: 24, bottom: 54, left: 42 };

  $: minimumWidth = Math.max(760, indexed.analysis.modelCalls.length * 68);
  $: width = Math.max(minimumWidth, observedWidth);
  $: river = layoutContextRiver(indexed, {
    width,
    height,
    margin,
    minimumVisibleThickness: 1,
  });
  $: columnByCall = new Map(river.columns.map((column) => [column.callIndex, column]));
  $: selectedRelated = interaction.selectedItemId
    ? relatedItemIds(interaction.selectedItemId, indexed.analysis.lineage)
    : null;
  $: hoveredRelated = interaction.hoveredItemId
    ? relatedItemIds(interaction.hoveredItemId, indexed.analysis.lineage)
    : null;

  onMount(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth && nextWidth > 0) observedWidth = nextWidth;
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  function pointerCall(event: PointerEvent): number | null {
    const rect = svg.getBoundingClientRect();
    const x = clientXToViewBox(event.clientX, rect.left, rect.width, width);
    if (x < margin.left || x > width - margin.right) return null;
    return nearestCallIndex(x, river.columns);
  }

  function pointerMove(event: PointerEvent): void {
    onHoverCall(pointerCall(event));
  }

  function backgroundClick(event: MouseEvent): void {
    const callIndex = pointerCall(event as PointerEvent);
    if (callIndex !== null) onEmptyClick(callIndex);
  }

  function selectFromKeyboard(event: KeyboardEvent, id: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectItem(id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  }

  function pinFromKeyboard(event: KeyboardEvent, callIndex: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPinCall(callIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  }

  function itemAccessibleLabel(id: string): string {
    const item = indexed.itemById.get(id);
    return item?.preview?.text || item?.label || id;
  }

  function isDimmed(id: string): boolean {
    return selectedRelated !== null && !selectedRelated.has(id);
  }

  function isRelated(id: string): boolean {
    return selectedRelated?.has(id) === true && interaction.selectedItemId !== id;
  }

  function connectorVisible(from: string, to: string): boolean {
    const focus = selectedRelated ?? hoveredRelated;
    return focus?.has(from) === true && focus.has(to);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
<div
  class="river-scroll"
  bind:this={host}
  data-testid="river-host"
  role="application"
  aria-label="Context River"
  aria-describedby="context-river-description"
  onpointermove={pointerMove}
  onpointerleave={() => { onHoverCall(null); onHoverItem(null); }}
  onclick={backgroundClick}
>
  <span id="context-river-description" class="sr-only">Context items flow horizontally through model calls. Dashed vertical markers indicate compaction. {indexed.analysis.displayWeightUnit === 'unavailable' ? 'Token geometry is unavailable; ribbon regions are structural placeholders, not measured token widths.' : ''}</span>
  <svg bind:this={svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
    <defs>
      <pattern id="unknown-geometry" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="8" height="8" fill="#46516a" />
        <path d="M0 0V8" stroke="#8793aa" stroke-width="2" opacity=".65" />
      </pattern>
    </defs>
    <rect class="plot-background" x={margin.left} y={margin.top} width={river.innerWidth} height={river.innerHeight} />

    {#each river.columns as column (column.callIndex)}
      <line class="column-guide" x1={column.x} x2={column.x} y1={margin.top} y2={height - margin.bottom} />
      <g
        class="call-target"
        class:pinned={interaction.pinnedCallIndex === column.callIndex}
        role="button"
        tabindex="0"
        aria-label={`Pin model call ${column.callIndex}`}
        onkeydown={(event) => pinFromKeyboard(event, column.callIndex)}
        onclick={(event) => { event.stopPropagation(); onPinCall(column.callIndex); }}
      >
        <rect x={column.x - 22} y={height - margin.bottom + 5} width="44" height="38" />
        <text x={column.x} y={height - 17} text-anchor="middle">{column.callIndex}</text>
      </g>
    {/each}

    {#each river.compactions as compaction (compaction.compactionId)}
      <g class="compaction-marker" aria-label={`Compaction before call ${compaction.beforeModelCall}`}>
        <line x1={compaction.x} x2={compaction.x} y1={margin.top - 8} y2={height - margin.bottom} />
        <text x={compaction.x + 5} y={margin.top - 13}>COMPACT</text>
      </g>
    {/each}

    {#each river.lineageConnectors as connector (connector.key)}
      <path
        class="lineage-connector"
        class:visible={connectorVisible(connector.fromItemId, connector.toItemId)}
        d={connector.path}
      />
    {/each}

    {#each river.ribbons as ribbon (ribbon.key)}
      <g
        class="ribbon-group"
        class:dimmed={isDimmed(ribbon.itemId)}
        class:related={isRelated(ribbon.itemId)}
        class:selected={interaction.selectedItemId === ribbon.itemId}
        class:hovered={interaction.hoveredItemId === ribbon.itemId}
        class:unknown={indexed.analysis.displayWeightUnit === 'unavailable'}
      >
        <path
          class="ribbon"
          class:subpixel={ribbon.isSubpixel}
          d={ribbon.path}
          fill={indexed.analysis.displayWeightUnit === 'unavailable' ? 'url(#unknown-geometry)' : itemColor(ribbon.itemId)}
          stroke={ribbon.isSubpixel ? itemColor(ribbon.itemId) : 'none'}
          stroke-width={ribbon.isSubpixel ? 1.25 : 0}
        />
        <path
          class="ribbon-hit"
          d={ribbon.hitPath}
          role="button"
          tabindex="0"
          aria-label={`${indexed.itemById.get(ribbon.itemId)?.kind ?? 'other'}: ${itemAccessibleLabel(ribbon.itemId)}`}
          aria-pressed={interaction.selectedItemId === ribbon.itemId}
          onpointerenter={() => onHoverItem(ribbon.itemId)}
          onpointerleave={() => onHoverItem(null)}
          onclick={(event) => { event.stopPropagation(); onSelectItem(ribbon.itemId); }}
          onkeydown={(event) => selectFromKeyboard(event, ribbon.itemId)}
        >
          <title>{itemAccessibleLabel(ribbon.itemId)}</title>
        </path>
      </g>
    {/each}

    {#if interaction.hoveredCallIndex !== null}
      {@const column = columnByCall.get(interaction.hoveredCallIndex)}
      {#if column}<line class="crosshair" x1={column.x} x2={column.x} y1={margin.top} y2={height - margin.bottom} />{/if}
    {/if}
    {#if interaction.pinnedCallIndex !== null}
      {@const column = columnByCall.get(interaction.pinnedCallIndex)}
      {#if column}<line class="pin-line" x1={column.x} x2={column.x} y1={margin.top} y2={height - margin.bottom} />{/if}
    {/if}
  </svg>
</div>

<style>
  .river-scroll { overflow-x: auto; max-width: 100%; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  svg { display: block; background: #0c1324; border-radius: 10px; touch-action: none; }
  .plot-background { fill: #0c1324; }
  .column-guide { stroke: #202c45; stroke-width: 1; pointer-events: none; }
  .call-target { cursor: pointer; color: #95a2ba; }
  .call-target rect { fill: transparent; }
  .call-target text { fill: currentColor; font-size: 12px; }
  .call-target:hover, .call-target:focus-visible, .call-target.pinned { color: #fff; outline: none; }
  .call-target:focus-visible rect { stroke: #fff; stroke-width: 2; }
  .compaction-marker { pointer-events: none; }
  .compaction-marker line { stroke: #ffb14e; stroke-width: 1.5; stroke-dasharray: 6 5; }
  .compaction-marker text { fill: #ffca87; font-size: 10px; font-weight: 700; letter-spacing: .08em; }
  .ribbon-group { opacity: .88; transition: opacity 120ms ease; }
  .ribbon-group.dimmed { opacity: .1; }
  .ribbon-group.related { opacity: .82; }
  .ribbon-group.unknown { opacity: .92; }
  .ribbon-group.selected, .ribbon-group.hovered { opacity: 1; filter: drop-shadow(0 0 5px rgba(255,255,255,.55)); }
  .ribbon { pointer-events: none; }
  .ribbon.subpixel { paint-order: stroke; }
  .ribbon-group.selected .ribbon { stroke: #fff; stroke-width: 2.5; }
  .ribbon-group.related .ribbon { stroke: #cfe0ff; stroke-width: 1.3; }
  .ribbon-hit { fill: transparent; stroke: transparent; stroke-width: 12; cursor: pointer; pointer-events: all; }
  .ribbon-hit:focus-visible { stroke: rgba(255,255,255,.75); stroke-width: 3; outline: none; }
  .lineage-connector { fill: none; stroke: #fff; stroke-width: 1.5; stroke-dasharray: 4 4; opacity: 0; pointer-events: none; }
  .lineage-connector.visible { opacity: .88; }
  .crosshair { stroke: #a8bde8; stroke-width: 1; stroke-dasharray: 4 4; pointer-events: none; }
  .pin-line { stroke: #fff; stroke-width: 2; pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .ribbon-group { transition: none; } }
</style>
