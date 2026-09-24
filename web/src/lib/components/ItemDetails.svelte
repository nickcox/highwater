<script lang="ts">
  import type { ContextItem, IndexedAnalysis } from '../types';
  import { displayItemLabel } from '../item-label';
  import { presenceCount } from '../context-river/lifespans';
  import { describeTokenDiagnostic } from '../diagnostics';
  import CopyButton from './CopyButton.svelte';
  import {
    coverageLabel,
    exposureLabel,
    formatMetric,
    formatWeight,
  } from '../context-river/format';

  export let item: ContextItem | null;
  export let indexed: IndexedAnalysis;
  export let callIndex: number | null = null;
  export let onSelectItem: (id: string) => void = () => {};

  $: sourceCompactions = item ? (indexed.compactionBySourceId.get(item.id) ?? []) : [];
  $: summaryCompaction = item ? (indexed.compactionBySummaryId.get(item.id) ?? null) : null;
  $: retainedCompactions = item ? (indexed.compactionsByRetainedId.get(item.id) ?? []) : [];
  $: directPredecessors = item
    ? (indexed.incomingLineage.get(item.id) ?? []).map((edge) => edge.from)
    : [];
  $: directSuccessors = item
    ? (indexed.outgoingLineage.get(item.id) ?? []).map((edge) => edge.to)
    : [];
  $: finalCallIndex = indexed.analysis.modelCalls[indexed.analysis.modelCalls.length - 1]?.index;
  $: callCount = indexed.analysis.modelCalls.length;
  $: requestedCall = callIndex === null ? null : (indexed.callByIndex.get(callIndex) ?? null);
  $: latestPresentCall =
    item && item.presence.length > 0 ? (indexed.callByIndex.get(item.lastModelCall) ?? null) : null;
  $: selectedCall = requestedCall ?? latestPresentCall;
  $: selectedEstimate = item
    ? (item.tokenEstimates.find(
        (estimate) => estimate.profileId === selectedCall?.tokenizationProfileId,
      ) ?? item.tokenEstimates[0])
    : undefined;
  $: hasExpandedPreview =
    item?.preview !== null &&
    item?.preview !== undefined &&
    (item.preview.expandedText !== item.preview.text || item.preview.expandedTruncated);
  $: itemDiagnosticCodes = [
    ...new Set(item?.tokenEstimates.flatMap((estimate) => estimate.noteCodes) ?? []),
  ];

  function itemLabel(id: string): string {
    return displayItemLabel(indexed.itemById.get(id), id);
  }
</script>

<section class="item-details" aria-live="polite">
  {#if item}
    <header>
      <span>{item.kind}</span>
      <h3>{displayItemLabel(item)}</h3>
    </header>
    {#if item.preview?.text}<p class="content-preview">
        <b>Content preview</b>
        {item.preview.text}
      </p>{/if}
    {#if item.preview?.truncated}<p class="preview-note">
        Compact preview truncated; technical identifiers are available below.
      </p>{/if}
    {#if hasExpandedPreview && item.preview}
      <details class="preview-details">
        <summary>Show more context</summary>
        <pre>{item.preview.expandedText}</pre>
        {#if item.preview.expandedTruncated}<p class="preview-note">
            Expanded preview truncated.
          </p>{/if}
      </details>
    {/if}

    <dl class="essential-metrics">
      <div>
        <dt>Lifetime</dt>
        <dd>
          {#if item.presence.length === 0}
            No model-call presence
          {:else}
            Calls {item.firstModelCall}–{item.lastModelCall} · present in {formatMetric(
              presenceCount(item),
            )} of {formatMetric(callCount)} calls ({formatMetric(item.presence.length)} ranges)
          {/if}
        </dd>
      </div>
      <div>
        <dt>Calculated tokens</dt>
        <dd>{formatMetric(selectedEstimate?.tokens)}</dd>
      </div>
      <div>
        <dt>Estimate basis</dt>
        <dd>
          {selectedCall
            ? `${selectedEstimate?.profileId ?? 'Unavailable'} · call ${selectedCall.index}`
            : (selectedEstimate?.profileId ?? 'No model-call profile')}
        </dd>
      </div>
      <div>
        <dt>Calculated token-turns</dt>
        <dd>{exposureLabel(item.tokenTurns, 'calculatedTokens')}</dd>
      </div>
    </dl>

    {#if directPredecessors.length > 0 || directSuccessors.length > 0}
      <div class="lineage-actions">
        <b>Lineage actions</b>
        {#if directPredecessors.length > 0}<div class="relations">
            <span>Predecessors</span>
            {#each directPredecessors as id}<button
                type="button"
                aria-label={`Select predecessor ${itemLabel(id)}`}
                onclick={() => onSelectItem(id)}>{itemLabel(id)}</button
              >{/each}
          </div>{/if}
        {#if directSuccessors.length > 0}<div class="relations">
            <span>Successors</span>
            {#each directSuccessors as id}<button
                type="button"
                aria-label={`Select successor ${itemLabel(id)}`}
                onclick={() => onSelectItem(id)}>{itemLabel(id)}</button
              >{/each}
          </div>{/if}
      </div>
    {/if}

    <details class="item-diagnostics">
      <summary>Token estimates and diagnostics</summary>
      <dl class="detail-rows">
        <div>
          <dt>Token coverage</dt>
          <dd>
            {coverageLabel(
              item.tokenTurnsCoverage.coveredCalls,
              item.tokenTurnsCoverage.totalCalls,
            )}
            calls covered
          </dd>
        </div>
        <div>
          <dt>Serialized diagnostic size</dt>
          <dd>{formatWeight(item.displayWeight, 'serializedBytes')}</dd>
        </div>
        <div>
          <dt>Presence ranges</dt>
          <dd>
            {item.presence.map((range) => `${range.startCall}–${range.endCall}`).join(', ') ||
              'None'}
          </dd>
        </div>
        <div>
          <dt>Age at final model call</dt>
          <dd>
            {item.ageAtFinalModelCall === null
              ? 'Unknown'
              : `${formatMetric(item.ageAtFinalModelCall)} calls`}
          </dd>
        </div>
        <div>
          <dt>Present at final model call</dt>
          <dd>
            {item.lastModelCall === finalCallIndex && item.presence.length > 0 ? 'Yes' : 'No'}
          </dd>
        </div>
        {#if selectedEstimate}
          <div>
            <dt>Selected estimate method</dt>
            <dd>{selectedEstimate.method}</dd>
          </div>
          <div>
            <dt>Selected estimate coverage</dt>
            <dd>{selectedEstimate.coverage}</dd>
          </div>
        {/if}
      </dl>
      <h4>Profile estimates</h4>
      {#if item.tokenEstimates.length === 0}
        <p>Unavailable</p>
      {:else}
        <ul>
          {#each item.tokenEstimates as estimate (estimate.profileId)}
            <li>
              <b>{estimate.profileId}</b> · {formatMetric(estimate.tokens)} tokens ·
              {estimate.method} · {estimate.coverage}
            </li>
          {/each}
        </ul>
      {/if}
      {#if itemDiagnosticCodes.length > 0}
        <h4>Diagnostic explanations</h4>
        <ul class="diagnostics">
          {#each itemDiagnosticCodes as code (code)}
            {@const description = describeTokenDiagnostic(code)}
            <li>
              {#if description}<b>{description.title}</b> — {description.impact}
              {:else}<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if sourceCompactions.length > 0 || retainedCompactions.length > 0 || summaryCompaction}
        <h4>Compaction and lineage</h4>
        {#if sourceCompactions.length > 0}<p>
            Structurally replaced before call {sourceCompactions
              .map((event) => event.beforeModelCall)
              .join(', ')}. Connector width does not represent contribution.
          </p>{/if}
        {#if retainedCompactions.length > 0}<p>
            Retained unchanged through compaction before call {retainedCompactions
              .map((event) => event.beforeModelCall)
              .join(', ')}.
          </p>{/if}
        {#if summaryCompaction}<p>
            Summary of {formatMetric(summaryCompaction.sourceItemIds.length)} structurally replaced items
            before call {summaryCompaction.beforeModelCall}.
          </p>{/if}
      {/if}
    </details>

    <details class="technical-identifiers">
      <summary>Technical identifiers</summary>
      <dl class="identifier-list">
        <div>
          <dt>Context ID</dt>
          <dd><code>{item.id}</code><CopyButton value={item.id} label="context ID" /></dd>
        </div>
        {#if item.sourceRecordId}<div>
            <dt>Source record ID</dt>
            <dd>
              <code>{item.sourceRecordId}</code>
              <CopyButton value={item.sourceRecordId} label="source record ID" />
            </dd>
          </div>{/if}
        {#if item.sourceToolCallId}<div>
            <dt>Source tool-call ID</dt>
            <dd>
              <code>{item.sourceToolCallId}</code>
              <CopyButton value={item.sourceToolCallId} label="source tool-call ID" />
            </dd>
          </div>{/if}
      </dl>
      {#if Object.keys(item.metadata).length > 0}<h4>Source metadata</h4>
        <ul>
          {#each Object.entries(item.metadata) as [key, value]}<li><b>{key}</b>: {value}</li>{/each}
        </ul>{/if}
      {#if itemDiagnosticCodes.length > 0}<h4>Raw diagnostic codes</h4>
        <ul>
          {#each itemDiagnosticCodes as code (code)}<li><code>{code}</code></li>{/each}
        </ul>{/if}
    </details>
  {:else}
    <h3>No context item selected</h3>
    <p>Click a ribbon or lifespan segment to select a context item.</p>
  {/if}
</section>

<style>
  .item-details {
    color: #bdc7d8;
    min-width: 0;
  }
  header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  header span {
    display: inline-block;
    color: #b8c7e3;
    border: 1px solid #3a496a;
    border-radius: 999px;
    padding: 2px 7px;
    font-size: 11px;
  }
  h3 {
    color: #fff;
    font-size: 15px;
    margin: 0 0 6px;
    overflow-wrap: anywhere;
  }
  h4 {
    margin: 11px 0 4px;
    color: #c8d5ed;
    font-size: 12px;
  }
  .content-preview {
    color: #c3ccdc;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .preview-note {
    color: #9caac0;
    font-size: 12px;
  }
  details {
    margin-top: 10px;
  }
  summary {
    color: #c8d5ed;
    cursor: pointer;
  }
  summary:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 3px;
    border-radius: 2px;
  }
  .preview-details pre {
    color: #e1e7f2;
    background: #0b1223;
    border-radius: 6px;
    margin: 7px 0 0;
    padding: 8px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
  }
  .essential-metrics,
  .detail-rows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 14px;
    margin: 10px 0 0;
  }
  dt {
    color: #8996ad;
    font-size: 11px;
  }
  dd {
    margin: 1px 0 0;
    overflow-wrap: anywhere;
    color: #e2e8f3;
  }
  .lineage-actions {
    display: grid;
    gap: 7px;
    margin-top: 10px;
  }
  .relations {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  .relations span {
    color: #8996ad;
    font-size: 11px;
  }
  .relations button {
    max-width: 100%;
    overflow-wrap: anywhere;
    text-align: left;
  }
  .diagnostics,
  .item-diagnostics ul,
  .technical-identifiers ul {
    margin: 4px 0 0;
    padding-left: 18px;
    overflow-wrap: anywhere;
    font-size: 12px;
  }
  .identifier-list {
    display: grid;
    gap: 7px;
    margin: 8px 0 0;
  }
  .identifier-list dd {
    display: grid;
    justify-items: start;
    gap: 4px;
  }
  code {
    color: #9fb2d5;
    overflow-wrap: anywhere;
    user-select: all;
  }
  .technical-identifiers code {
    display: block;
  }
  p {
    margin: 8px 0 0;
  }
  @media (max-width: 520px) {
    .essential-metrics,
    .detail-rows {
      grid-template-columns: 1fr;
    }
  }
</style>
