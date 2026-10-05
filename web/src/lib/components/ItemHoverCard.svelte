<script lang="ts">
  import type { ContextItem, IndexedAnalysis } from '../types';
  import { displayItemLabel } from '../item-label';
  import { coverageLabel, exposureLabel, formatWeight } from '../context-river/format';
  import { presenceCount, tokenTurnExposure } from '../context-river/lifespans';

  export let item: ContextItem | null;
  export let indexed: IndexedAnalysis;

  $: sourceCompactions = item ? (indexed.compactionBySourceId.get(item.id) ?? []) : [];
  $: summaryCompaction = item ? (indexed.compactionBySummaryId.get(item.id) ?? null) : null;
  $: lineageText =
    sourceCompactions.length > 0
      ? `Structurally replaced before call ${sourceCompactions.map((event) => event.beforeModelCall).join(', ')}`
      : summaryCompaction
        ? `Summary of ${summaryCompaction.sourceItemIds.length} structural source items`
        : null;
</script>

{#if item}
  <section class="item-hover-card" aria-label={`Context item ${displayItemLabel(item)}`}>
    <header><span>{item.kind}</span><strong>{displayItemLabel(item)}</strong></header>
    {#if item.preview?.text}<p class="content-preview">{item.preview.text}</p>{/if}
    {#if item.preview?.truncated}<p class="preview-note">Preview truncated</p>{/if}
    <dl>
      <div>
        <dt>Present</dt>
        <dd>Calls {item.firstModelCall}–{item.lastModelCall}</dd>
      </div>
      <div>
        <dt>Lifetime</dt>
        <dd>
          {presenceCount(item)} calls · {item.presence.length} range{item.presence.length === 1
            ? ''
            : 's'}
        </dd>
      </div>
      <div>
        <dt>Serialized size</dt>
        <dd>{formatWeight(item.displayWeight, 'serializedBytes')}</dd>
      </div>
      <div>
        <dt>Calculated token-turns</dt>
        <dd>{exposureLabel(tokenTurnExposure(item), 'calculatedTokens')}</dd>
      </div>
      <div>
        <dt>Token coverage</dt>
        <dd>
          {coverageLabel(item.tokenTurnsCoverage.coveredCalls, item.tokenTurnsCoverage.totalCalls)}
        </dd>
      </div>
    </dl>
    {#if lineageText}<p class="lineage">{lineageText}</p>{/if}
  </section>
{/if}

<style>
  .item-hover-card {
    min-width: 300px;
    max-width: 360px;
    padding: 10px;
    color: #c3ccdc;
    background: var(--surface);
    border: 1px solid var(--control-border);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }
  header span {
    width: fit-content;
    color: #b8c7e3;
    border: 1px solid #3a496a;
    border-radius: 999px;
    padding: 2px 7px;
    font-size: 12px;
  }
  header strong {
    color: #fff;
    overflow-wrap: anywhere;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(120px, 1fr));
    gap: 7px;
    margin: 0;
  }
  dl div {
    background: var(--plot);
    border-radius: 6px;
    padding: 6px 8px;
  }
  dt {
    color: var(--secondary);
    font-size: 12px;
  }
  dd {
    margin: 1px 0 0;
    color: #eef2f8;
  }
  p {
    margin: 9px 0 0;
  }
  .content-preview {
    margin: 0 0 9px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: #c3ccdc;
  }
  .preview-note {
    color: var(--secondary);
    font-size: 12px;
  }
  .lineage {
    border-left: 3px dashed #ffb14e;
    padding-left: 8px;
    color: #d8c6a8;
  }
</style>
