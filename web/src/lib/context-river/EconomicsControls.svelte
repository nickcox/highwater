<script lang="ts">
  import EventGlyph from './EventGlyph.svelte';
  import InfoPopover from '../components/InfoPopover.svelte';
  import type {
    CacheViewMode,
    EconomicsTrackMode,
    projectCachePresentation,
  } from './economics-track';
  import type { describeCostBasis } from '../cost-basis';

  let {
    mode,
    lastMode,
    cacheView,
    cachePresentation,
    costCopy,
    hasApiEquivalentCost = false,
    onModeChange,
    onCacheViewChange,
    headerElement = $bindable(),
    triggerElement = $bindable(),
  }: {
    mode: EconomicsTrackMode;
    lastMode: 'cache' | 'cost';
    cacheView: CacheViewMode;
    cachePresentation: ReturnType<typeof projectCachePresentation>;
    costCopy: ReturnType<typeof describeCostBasis>;
    /** Some calls are covered by a subscription and drawn as API-equivalent costs. */
    hasApiEquivalentCost?: boolean;
    onModeChange: (mode: EconomicsTrackMode) => void;
    onCacheViewChange: (view: CacheViewMode) => void;
    /** Bound by the River, which returns focus here and checks focus containment. */
    headerElement?: HTMLDivElement;
    triggerElement?: HTMLButtonElement;
  } = $props();
</script>

<!-- Stops pointer and click events reaching the River's drag-to-zoom gestures;
     the controls inside are ordinary buttons. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div
  class="economics-track-header"
  bind:this={headerElement}
  role="group"
  aria-label="Economics track controls and legend"
  onpointerdown={(event) => event.stopPropagation()}
  onclick={(event) => event.stopPropagation()}
>
  <button
    bind:this={triggerElement}
    class="economics-disclosure disclosure"
    type="button"
    aria-expanded={mode !== 'off'}
    aria-controls="economics-expanded"
    onclick={() => onModeChange(mode === 'off' ? lastMode : 'off')}
  >
    <span>Cache &amp; cost</span>
  </button>
  <div id="economics-expanded" hidden={mode === 'off'}>
    {#if mode !== 'off'}
      <div class="economics-track-controls">
        <div class="toggle-group" role="group" aria-label="Economics track">
          <span class="toggle-label">Economics</span>
          <button
            type="button"
            aria-pressed={mode === 'cache'}
            onclick={() => onModeChange('cache')}>Cache</button
          >
          <button type="button" aria-pressed={mode === 'cost'} onclick={() => onModeChange('cost')}
            >Cost</button
          >
          <button type="button" aria-pressed={false} onclick={() => onModeChange('off')}>Off</button
          >
        </div>
        {#if mode === 'cache'}
          <div class="toggle-group cache-view-toggle" role="group" aria-label="Cache view">
            <span class="toggle-label">Cache view</span>
            <button
              type="button"
              aria-pressed={cacheView === 'tokens'}
              onclick={() => onCacheViewChange('tokens')}>Tokens</button
            >
            <button
              type="button"
              aria-pressed={cacheView === 'share'}
              onclick={() => onCacheViewChange('share')}>Share (%)</button
            ><InfoPopover id="cache-share-note" label="About Share (%)"
              >Shows cache reads, cache writes and fresh input as shares of each call's input
              tokens. Calls with missing, partial or zero input are marked, not drawn as zero.</InfoPopover
            >
          </div>
        {/if}
        <span class="track-title">
          {mode === 'cache'
            ? cacheView === 'share'
              ? "Cache share per call · share of each call's input · fixed 0–100% axis"
              : 'Prompt tokens per call · session-wide scale'
            : mode === 'cost'
              ? 'Cost per call · USD · session-wide scale · recorded or estimated, not invoices'
              : 'Economics off · details remain available in the inspector'}
        </span>
      </div>
    {/if}
    {#if mode !== 'off'}
      <div class="track-legend-groups essential-legend">
        {#if mode === 'cache'}
          <div class="track-legend-group" aria-label="Token categories">
            <span class="legend-group-title">Token categories</span>
            <div class="track-legend">
              {#each cachePresentation.categories as category (category.kind)}
                <span
                  ><i class={`swatch ${category.kind}`}
                  ></i>{category.label}{category.availability === 'measuredZero'
                    ? ' · 0 in this session'
                    : ''}</span
                >
              {:else}
                <span class="legend-muted">No supported numeric cache categories</span>
              {/each}
            </div>
          </div>
          {#each cachePresentation.notes as note}<span class="inline-availability">{note}</span
            >{/each}
        {:else}
          <div class="track-legend-group" aria-label="Cost values">
            <span class="legend-group-title">Cost values</span>
            <div class="track-legend">
              <span><i class="swatch cost"></i>Billed · USD</span>
              {#if hasApiEquivalentCost}<span
                  ><i class="swatch api-equivalent"></i>API-equivalent (subscription) · USD</span
                >{/if}
            </div>
          </div>
        {/if}
      </div>
      <!-- What the event symbols and data-quality marks mean, and in Cost mode, the cost marks. -->
      <details class="economics-legend">
        <summary class="disclosure">Key</summary>
        <div class="track-legend-group" aria-label="Events">
          <span class="legend-group-title">Events</span>
          <div class="track-legend">
            {#if mode === 'cache'}<span
                ><EventGlyph kind="ratioChange" direction="rise" size={16} />Share rise/drop</span
              >{/if}
            <span><EventGlyph kind="compaction" size={16} />Compaction</span>
            <span><EventGlyph kind="targetChange" size={16} />Model / provider change</span>
          </div>
        </div>
        <div class="track-legend-group" aria-label="Data quality">
          <span class="legend-group-title">Data quality</span>
          <div class="track-legend">
            <span><i class="swatch uncertain"></i>Partial / unsupported</span>
            <span><i class="swatch missing"></i>Missing</span>
            <span><i class="swatch zero"></i>Measured zero</span>
          </div>
        </div>
        {#if mode === 'cost'}
          <p class="availability-summary">
            Billed calls show the cost the harness recorded, or an estimate at the provider's rate
            when it recorded none. Subscription calls show what they would have cost at the lab's
            API rate; that is not a charge. A shaded bar marks a range. {costCopy.note}
            Unavailable values are not zero.
          </p>
        {/if}
      </details>
    {/if}
  </div>
</div>

<style>
  .economics-disclosure {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 4px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--secondary);
    font: inherit;
    font-size: var(--text-md);
  }
  .economics-disclosure:hover {
    background: transparent;
    color: var(--text);
  }
  .economics-track-header {
    position: sticky;
    left: 0;
    z-index: 3;
    display: grid;
    width: 100%;
    gap: 6px;
    margin: 0 0 8px;
    padding: 8px 0;
    border: 0;
    border-top: 1px solid var(--separator);
    border-radius: 0;
    background: var(--surface);
  }
  .economics-track-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px 14px;
    color: var(--text);
    font-size: var(--text-sm);
  }
  .economics-legend {
    min-width: 0;
    color: var(--text);
    font-size: var(--text-xs);
  }
  .economics-legend[open] {
    padding-top: 2px;
  }
  .economics-legend summary {
    width: fit-content;
    color: var(--secondary);
    cursor: pointer;
  }
  /* Matches the River's legend: 12px text, with each group's title leading its items. */
  .track-legend-groups {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    gap: 8px 18px;
    padding-top: 6px;
    color: var(--text);
    font-size: var(--text-sm);
  }
  .essential-legend {
    padding: 2px 0 0;
  }
  .legend-muted,
  .availability-summary {
    color: var(--secondary);
  }
  .inline-availability {
    align-self: center;
    max-width: 38rem;
    color: var(--warning);
    line-height: 1.35;
  }
  .availability-summary {
    margin: 6px 0;
    line-height: 1.4;
  }
  .track-title {
    min-width: 0;
    color: var(--text);
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  .track-legend-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px 12px;
    min-width: 0;
  }
  .legend-group-title {
    color: var(--text-strong);
    font-weight: 650;
  }
  .track-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 12px;
    align-items: center;
  }
  .track-legend span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1px solid var(--text);
    border-radius: var(--radius-small);
    flex: 0 0 auto;
  }
  .swatch.read,
  .swatch.cacheRead {
    background: #428fdc;
  }
  .swatch.write,
  .swatch.cacheWrite {
    background: repeating-linear-gradient(135deg, #9167c7 0 3px, #e0c9ff 3px 4px);
  }
  .swatch.fresh {
    background: radial-gradient(circle, #b5f6df 1px, #277d68 1.5px);
  }
  .swatch.nonread,
  .swatch.nonRead {
    background: repeating-linear-gradient(135deg, #49536a 0 3px, #aab5c9 3px 4px);
  }
  .swatch.uncached {
    background: radial-gradient(circle, #b5f6df 1px, #277d68 1.5px);
  }
  .swatch.uncertain {
    background: transparent;
    border-color: var(--warning);
    transform: rotate(45deg) scale(0.78);
  }
  .swatch.change-rise,
  .swatch.change-drop {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    border: 0;
    color: var(--page);
    background: #ffbd64;
    font-size: 10px;
    font-style: normal;
    font-weight: 800;
    line-height: 1;
  }
  .swatch.change-drop {
    margin-left: -4px;
  }
  .swatch.compaction,
  .swatch.target {
    display: inline-flex;
    width: 16px;
    justify-content: center;
    border-color: var(--accent);
    background: var(--action);
    color: #fff;
    font-size: 7px;
    font-style: normal;
    font-weight: 750;
  }
  .swatch.target {
    border-radius: 0;
    transform: rotate(45deg) scale(0.8);
  }
  .swatch.missing {
    background: transparent;
    border-style: dashed;
  }
  .swatch.zero {
    border-radius: 50%;
    background: transparent;
  }
  .swatch.cost {
    border-radius: 50%;
    background: #7ddbb7;
  }
  .swatch.api-equivalent {
    border-radius: 50%;
    background: transparent;
    border-color: #b9a8ff;
  }
  @media (max-width: 620px) {
    .economics-track-controls {
      align-items: start;
    }
    .track-legend {
      gap: 5px 9px;
    }
  }
</style>
