<script lang="ts">
  import type { ContextItem, IndexedAnalysis } from '../types';
  import { presenceCount } from '../context-river/lifespans';
  import { coverageLabel, exposureLabel, formatMetric, formatWeight } from '../context-river/format';

  export let item: ContextItem | null;
  export let indexed: IndexedAnalysis;
  export let callIndex: number | null = null;
  export let onSelectItem: (id: string) => void = () => {};

  $: sourceCompactions = item ? (indexed.compactionBySourceId.get(item.id) ?? []) : [];
  $: summaryCompaction = item ? indexed.compactionBySummaryId.get(item.id) ?? null : null;
  $: retainedCompactions = item
    ? indexed.analysis.compactions.filter((event) => event.retainedItemIds.includes(item.id))
    : [];
  $: directPredecessors = item ? (indexed.incomingLineage.get(item.id) ?? []).map((edge) => edge.from) : [];
  $: directSuccessors = item ? (indexed.outgoingLineage.get(item.id) ?? []).map((edge) => edge.to) : [];
  $: finalCallIndex = indexed.analysis.modelCalls[indexed.analysis.modelCalls.length - 1]?.index;
  $: requestedCall = callIndex === null ? null : indexed.callByIndex.get(callIndex) ?? null;
  $: latestPresentCall = item
    ? [...indexed.analysis.modelCalls].reverse().find((call) => call.contextItemIds.includes(item.id)) ?? null
    : null;
  $: selectedCall = requestedCall ?? latestPresentCall;
  $: selectedEstimate = item
    ? item.tokenEstimates.find((estimate) => estimate.profileId === selectedCall?.tokenizationProfileId) ?? item.tokenEstimates[0]
    : undefined;
  $: hasExpandedPreview = item?.preview !== null
    && item?.preview !== undefined
    && (item.preview.expandedText !== item.preview.text || item.preview.expandedTruncated);

  function togglePreview(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const summary = event.currentTarget as HTMLElement;
    const details = summary.parentElement as HTMLDetailsElement | null;
    if (details) details.open = !details.open;
  }
</script>

<section class="item-details" aria-live="polite">
  {#if item}
    <header><span>{item.kind}</span><h3>{item.preview?.text || item.label || 'Unlabelled context item'}</h3></header>
    {#if item.preview?.truncated}<p class="preview-note">Compact preview truncated; technical identifiers are available below.</p>{/if}
    {#if hasExpandedPreview && item.preview}
      <details class="preview-details">
        <summary onkeydown={togglePreview}>Show more context</summary>
        <pre>{item.preview.expandedText}</pre>
        {#if item.preview.expandedTruncated}<p class="preview-note">Expanded preview truncated.</p>{/if}
      </details>
    {/if}
    <dl>
      <div><dt>Entered</dt><dd>Call {item.firstModelCall}</dd></div>
      <div><dt>Last present</dt><dd>Call {item.lastModelCall}</dd></div>
      <div><dt>Present in</dt><dd>{presenceCount(item)} calls across {item.presence.length} range{item.presence.length === 1 ? '' : 's'}</dd></div>
      <div><dt>Calculated tokens</dt><dd>{formatMetric(selectedEstimate?.tokens)}</dd></div>
      <div><dt>Estimate profile</dt><dd>{selectedEstimate?.profileId ?? 'Unavailable'}{selectedCall ? ` · call ${selectedCall.index}` : ''}</dd></div>
      <div><dt>Calculated token-turns</dt><dd>{exposureLabel(item.tokenTurns, 'calculatedTokens')}</dd></div>
      <div><dt>Token coverage</dt><dd>{coverageLabel(item.tokenTurnsCoverage.coveredCalls, item.tokenTurnsCoverage.totalCalls)}</dd></div>
      <div><dt>Serialized diagnostic size</dt><dd>{formatWeight(item.displayWeight, 'serializedBytes')}</dd></div>
    </dl>
    <div class="ranges"><b>Presence:</b> {item.presence.map((range) => `${range.startCall}–${range.endCall}`).join(', ')}</div>
    <div class="ranges"><b>Age:</b> Entered at call {item.firstModelCall}; elapsed at final call {item.ageAtFinalModelCall === null ? 'Unknown' : `${item.ageAtFinalModelCall} calls`}</div>
    <div class="technical"><b>Profile estimates:</b> {item.tokenEstimates.length === 0 ? 'Unavailable' : item.tokenEstimates.map((estimate) => `${estimate.method}: ${formatMetric(estimate.tokens)} (${estimate.coverage})`).join(' · ')}</div>
    <div class="ids"><b>Context ID</b><code>{item.id}</code>{#if item.sourceRecordId}<b>Source record</b><code>{item.sourceRecordId}</code>{/if}{#if item.sourceToolCallId}<b>Tool call</b><code>{item.sourceToolCallId}</code>{/if}</div>
    {#if Object.keys(item.metadata).length > 0}<div class="metadata">{#each Object.entries(item.metadata) as [key, value]}<span><b>{key}</b> {value}</span>{/each}</div>{/if}
    {#if sourceCompactions.length > 0 || summaryCompaction}
      <p class="lineage-note">These items were structurally replaced by this summary. Connector width does not represent contribution.</p>
    {/if}
    {#if sourceCompactions.length > 0}<p>Compacted before call {sourceCompactions.map((event) => event.beforeModelCall).join(', ')}.</p>{/if}
    {#if retainedCompactions.length > 0}<p>Retained unchanged through compaction before call {retainedCompactions.map((event) => event.beforeModelCall).join(', ')}.</p>{/if}
    {#if item.lastModelCall === finalCallIndex}<p>Present at the final model call.</p>{/if}
    {#if directPredecessors.length > 0}<div class="relations"><b>Structural predecessors</b>{#each directPredecessors as id}<button type="button" onclick={() => onSelectItem(id)}>{indexed.itemById.get(id)?.label ?? id}</button>{/each}</div>{/if}
    {#if directSuccessors.length > 0}<div class="relations"><b>Structural successor</b>{#each directSuccessors as id}<button type="button" onclick={() => onSelectItem(id)}>{indexed.itemById.get(id)?.label ?? id}</button>{/each}</div>{/if}
  {:else}
    <h3>No context item selected</h3>
    <p>Click a ribbon or lifespan segment to follow that stable context item.</p>
  {/if}
</section>

<style>
  .item-details { color: #bdc7d8; }
  header span { display: inline-block; color: #b8c7e3; border: 1px solid #3a496a; border-radius: 999px; padding: 2px 7px; font-size: 11px; }
  h3 { color: #fff; font-size: 15px; margin: 6px 0 10px; overflow-wrap: anywhere; }
  dl { display: grid; grid-template-columns: repeat(2, minmax(130px, 1fr)); gap: 7px; margin: 0; }
  dl div { padding: 7px; background: #0b1223; border-radius: 6px; }
  dt { color: #8996ad; font-size: 11px; } dd { margin: 2px 0 0; }
  .ranges, .ids, .metadata, .relations, .technical, .preview-note, .preview-details { margin-top: 10px; }
  .preview-note { color: #9caac0; font-size: 12px; }
  .preview-details summary { color: #c8d5ed; cursor: pointer; }
  .preview-details pre { color: #e1e7f2; background: #0b1223; border-radius: 6px; margin: 7px 0 0; padding: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
  .technical { color: #9caac0; font-size: 12px; }
  .ids { display: grid; gap: 4px; }
  code { display: block; color: #9fb2d5; overflow-wrap: anywhere; user-select: all; }
  .metadata { display: flex; flex-wrap: wrap; gap: 6px 12px; }
  .metadata span { font-size: 12px; }
  p { margin: 9px 0 0; }
  .lineage-note { border-left: 3px dashed #ffb14e; padding-left: 9px; color: #d8c6a8; }
  .relations { display: flex; flex-direction: column; gap: 5px; }
  .relations button { text-align: left; }
</style>
