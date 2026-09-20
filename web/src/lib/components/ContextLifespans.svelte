<script lang="ts">
  import type { IndexedAnalysis, InteractionState, PresenceRange } from '../types';
  import { itemColor } from '../context-river/colors';
  import { presenceCount, sortLifespans, tokenTurnExposure } from '../context-river/lifespans';
  import { coverageLabel, exposureLabel } from '../context-river/format';
  import { relatedItemIds } from '../context-river/lineage';

  export let indexed: IndexedAnalysis;
  export let interaction: InteractionState;
  export let onSelectItem: (id: string) => void;
  export let onHoverItem: (id: string | null) => void;

  $: items = sortLifespans(indexed.analysis.contextItems);
  $: related = interaction.selectedItemId
    ? relatedItemIds(interaction.selectedItemId, indexed.analysis.lineage)
    : null;
  $: callCount = indexed.analysis.modelCalls.length;
  $: callPositionByIndex = new Map(
    indexed.analysis.modelCalls.map((call, index) => [call.index, index]),
  );

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
    const firstCall = indexed.analysis.modelCalls[0]?.index ?? 1;
    const lastCall = indexed.analysis.modelCalls[indexed.analysis.modelCalls.length - 1]?.index ?? 0;
    if (beforeCall > lastCall) return 100;
    const current = position(beforeCall);
    const previous = position(beforeCall - 1);
    return beforeCall <= firstCall
      ? Math.max(0, current - 1)
      : (current + previous) / 2;
  }

  function itemLabel(item: IndexedAnalysis['analysis']['contextItems'][number]): string {
    return item.preview?.text || item.label || 'Unlabelled item';
  }

  function isCompactedEnd(itemId: string, range: PresenceRange): boolean {
    return indexed.analysis.compactions.some(
      (event) => event.beforeModelCall === range.endCall + 1 && event.sourceItemIds.includes(itemId),
    );
  }
</script>

<section class="lifespans" aria-label="Context lifespans">
  <header><div><h2>Context lifespans</h2><p>Sorted by token-turn exposure when available; partial and unavailable items are labelled.</p></div><span>{items.length} items</span></header>
  <div class="rows">
    {#each items as item (item.id)}
      <div
        class="row"
        class:dimmed={related !== null && !related.has(item.id)}
        class:selected={interaction.selectedItemId === item.id}
      >
        <div class="label" title={itemLabel(item)}><span style={`background:${itemColor(item.id)}`}></span>{itemLabel(item)}</div>
        <div class="track">
          {#each indexed.analysis.compactions as compaction (compaction.id)}
            <span class="boundary" style={`left:${boundaryPosition(compaction.beforeModelCall)}%`} aria-hidden="true"></span>
          {/each}
          {#each item.presence as range, rangeIndex (`${item.id}:${rangeIndex}`)}
            <button
              type="button"
              class="segment"
              class:compacted={isCompactedEnd(item.id, range)}
              aria-label={`${item.kind}: ${itemLabel(item)}, calls ${range.startCall} through ${range.endCall}`}
              aria-pressed={interaction.selectedItemId === item.id}
              title={`${itemLabel(item)}: calls ${range.startCall}–${range.endCall}`}
              style={segmentStyle(range, itemColor(item.id))}
              onpointerenter={() => onHoverItem(item.id)}
              onpointerleave={() => onHoverItem(null)}
              onclick={() => onSelectItem(item.id)}
            ></button>
          {/each}
        </div>
        <div class="meta" title={`${presenceCount(item)} calls; ${coverageLabel(item.tokenTurnsCoverage.coveredCalls, item.tokenTurnsCoverage.totalCalls)} tokenized`}>
          {exposureLabel(tokenTurnExposure(item), 'calculatedTokens')}
          <small>{coverageLabel(item.tokenTurnsCoverage.coveredCalls, item.tokenTurnsCoverage.totalCalls)} calls</small>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  header { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 8px; }
  h2 { font-size: 15px; margin: 0; color: #fff; }
  header p { margin: 3px 0 0; color: #8f9cb2; font-size: 12px; }
  header > span { color: #8f9cb2; white-space: nowrap; }
  .rows { max-height: 560px; overflow-y: auto; }
  .row { display: grid; grid-template-columns: minmax(140px, 220px) 1fr 115px; gap: 10px; align-items: center; padding: 7px 3px; border-top: 1px solid #202b44; transition: opacity 120ms ease; }
  .row.dimmed { opacity: .16; }
  .row.selected { background: #16213a; }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c9d2e1; }
  .label span { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 7px; }
  .track { height: 22px; position: relative; background: #0b1223; border-radius: 5px; overflow: hidden; }
  .segment { position: absolute; top: 3px; height: 16px; min-width: 3px; padding: 0; border: 0; border-radius: 4px; cursor: pointer; }
  .segment.compacted { border-right: 4px double #fff; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.18) 0 3px, transparent 3px 7px); }
  .segment:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  .boundary { position: absolute; z-index: 2; height: 100%; border-left: 1px dashed #ffb14e; pointer-events: none; }
  .meta { text-align: right; color: #8f9cb2; font-size: 12px; white-space: nowrap; }
  .meta small { display: block; color: #6f7d95; font-size: 10px; }
  @media(max-width: 700px) { .row { grid-template-columns: 120px 1fr; } .meta { display: none; } }
  @media (prefers-reduced-motion: reduce) { .row { transition: none; } }
</style>
