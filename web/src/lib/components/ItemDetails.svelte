<script lang="ts">
  import type { ContextItem, IndexedAnalysis } from '../types';
  import { displayItemLabel } from '../item-label';
  import { presenceCount } from '../context-river/lifespans';
  import { describeTokenDiagnostic } from '../diagnostics';
  import CopyButton from './CopyButton.svelte';
  import {
    inspectorSections,
    rememberSection,
    type InspectorSections,
  } from '../state/inspector-sections';
  export let sections: InspectorSections = inspectorSections();
  export let onInspectCall: (index: number) => void = () => {};
  import {
    coverageLabel,
    exposureLabel,
    formatMetric,
    formatWeight,
  } from '../context-river/format';

  export let item: ContextItem | null;
  export let indexed: IndexedAnalysis;
  export let callIndex: number | null = null;
  export let pinnedCallIndex: number | null = null;
  export let onSelectItem: (id: string) => void = () => {};
  export let onRevealInRiver: (id: string) => void = () => {};

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
  $: pinnedCall =
    pinnedCallIndex === null ? null : (indexed.callByIndex.get(pinnedCallIndex) ?? null);
  $: absentAtPinnedCall =
    item !== null && pinnedCall !== null && !pinnedCall.contextItemIds.includes(item.id);
  $: firstIncludedCall = item?.presence.length
    ? (indexed.callByIndex.get(item.presence[0].startCall) ?? null)
    : null;
  $: latestPresentCall =
    item && item.presence.length > 0 ? (indexed.callByIndex.get(item.lastModelCall) ?? null) : null;
  $: selectedCall = (() => {
    if (requestedCall && requestedCall.contextItemIds.includes(item?.id ?? '')) {
      return requestedCall;
    }
    return pinnedCallIndex !== null ? null : latestPresentCall;
  })();
  $: usingLatestFallback = requestedCall === null && selectedCall !== null;
  $: selectedEstimate =
    item && selectedCall
      ? item.tokenEstimates.find(
          (estimate) => estimate.profileId === selectedCall?.tokenizationProfileId,
        )
      : undefined;
  $: selectedProfile = selectedEstimate
    ? (indexed.analysis.tokenAnalysis.profiles.find(
        (profile) => profile.id === selectedEstimate.profileId,
      ) ?? null)
    : null;
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

  function kindLabel(kind: ContextItem['kind']): string {
    return kind
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^\w/, (first) => first.toUpperCase());
  }

  function methodLabel(method: ContextItem['tokenEstimates'][number]['method']): string {
    switch (method) {
      case 'modelTokenizer':
        return 'Model tokenizer';
      case 'apiSerializationEstimate':
        return 'Estimated API serialization';
      case 'characterHeuristic':
        return 'Character heuristic';
      default:
        return 'Unavailable estimate method';
    }
  }

  function presenceLabel(): string {
    if (!item || item.presence.length === 0) return 'No model-call presence';
    return item.presence
      .map((range) =>
        range.startCall === range.endCall
          ? `call ${range.startCall}`
          : `calls ${range.startCall}–${range.endCall}`,
      )
      .join(', ');
  }
</script>

<section class="item-details" aria-live="polite">
  {#if item}
    <header class="item-identity">
      <div>
        <span>{kindLabel(item.kind)}</span>
        <h3 id="selected-item-summary" class="selected-item-summary" tabindex="-1">
          {displayItemLabel(item)}
        </h3>
      </div>
    </header>
    {#if item.presence.length === 0}
      <p class="presence-note">
        This item has no model-call presence, so it has no location to reveal in Context River.
      </p>
    {:else if absentAtPinnedCall && pinnedCall}
      <p class="presence-note">
        This item is not present at pinned call {pinnedCall.index}. Its inspector remains selected.
      </p>
    {/if}
    {#if item.presence.length > 0}<button type="button" onclick={() => onRevealInRiver(item.id)}
        >Reveal in River</button
      >{/if}
    {#if firstIncludedCall && firstIncludedCall.index !== pinnedCallIndex}<button
        type="button"
        onclick={() => onInspectCall(firstIncludedCall.index)}
        >Inspect first included call · {firstIncludedCall.index}</button
      >{/if}
    {#if selectedEstimate && (selectedEstimate.coverage !== 'complete' || selectedEstimate.method === 'characterHeuristic')}<p
        class="presence-note"
      >
        Estimate: {selectedEstimate.coverage} · {methodLabel(selectedEstimate.method)}
      </p>{/if}
    <details use:rememberSection={{ state: sections, key: 'preview' }}>
      <summary>Content preview</summary>
      <div class="preview-details">
        {#if hasExpandedPreview && sections.expandedPreview && item.preview}
          <pre>{item.preview.expandedText}</pre>
          {#if item.preview.expandedTruncated}<p class="preview-note">
              Expanded preview truncated.
            </p>{/if}
        {:else}
          {#if item.preview?.text}<p class="content-preview">
              <b>Content preview</b>
              {item.preview.text}
            </p>{:else}<p class="preview-note">No content preview is available.</p>{/if}
          {#if item.preview?.truncated}<p class="preview-note">
              Compact preview truncated; technical identifiers are available below.
            </p>{/if}
        {/if}
        {#if hasExpandedPreview}
          <button
            type="button"
            class="preview-toggle"
            aria-expanded={sections.expandedPreview}
            onclick={() => (sections.expandedPreview = !sections.expandedPreview)}
            >{sections.expandedPreview ? 'Show less' : 'Show more'}</button
          >
        {/if}
      </div>
    </details>
    <dl class="essential-metrics">
      <div>
        <dt>Lifetime</dt>
        <dd>
          {#if item.presence.length === 0}
            No model-call presence
          {:else}
            {presenceLabel()} · present in {formatMetric(presenceCount(item))} of {formatMetric(
              callCount,
            )} calls ({formatMetric(item.presence.length)} ranges)
          {/if}
        </dd>
      </div>
      <div>
        <dt>
          {#if selectedCall && selectedEstimate}
            {pinnedCallIndex !== null
              ? 'Tokens at pinned call'
              : usingLatestFallback
                ? 'Tokens at last included call'
                : 'Tokens at call'}
          {:else if pinnedCallIndex !== null}
            Tokens at pinned call · unavailable
          {:else}
            Tokens at last included call · unavailable
          {/if}
        </dt>
        <dd>
          {selectedEstimate
            ? `${formatMetric(selectedEstimate.tokens)} · call ${selectedCall?.index}`
            : 'Unavailable'}
          {#if usingLatestFallback}<small>Latest actual presence; not a newly pinned call.</small
            >{/if}
        </dd>
      </div>
      <div>
        <dt>Whole-session exposure · estimated token-turns</dt>
        <dd>
          {exposureLabel(item.tokenTurns, 'calculatedTokens')}
          {#if item.tokenTurnsCoverage.coveredCalls < item.tokenTurnsCoverage.totalCalls}<small
              >Partial exposure · {coverageLabel(
                item.tokenTurnsCoverage.coveredCalls,
                item.tokenTurnsCoverage.totalCalls,
              )} calls covered</small
            >{/if}
          {#if item.tokenEstimates.some((estimate) => estimate.coverage !== 'complete' || estimate.method === 'characterHeuristic')}<small
              >Includes partial, heuristic or unavailable profile estimates.</small
            >{/if}
        </dd>
      </div>
    </dl>
    <details use:rememberSection={{ state: sections, key: 'basis' }}>
      <summary>Estimate basis &amp; coverage</summary>
      {#if selectedCall && selectedEstimate}
        {selectedProfile
          ? `${selectedProfile.provider} / ${selectedProfile.model} · ${methodLabel(selectedEstimate.method)}`
          : methodLabel(selectedEstimate.method)} · call {selectedCall.index}
      {:else if pinnedCallIndex !== null}
        No applicable estimate at pinned call {pinnedCallIndex}
      {:else}
        No applicable model-call estimate
      {/if}
      · {selectedEstimate?.coverage ?? 'unavailable'}
    </details>

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

    <details class="item-diagnostics" use:rememberSection={{ state: sections, key: 'diagnostics' }}>
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

    <details
      class="technical-identifiers"
      use:rememberSection={{ state: sections, key: 'identifiers' }}
    >
      <summary>Technical identifiers</summary>
      <dl class="identifier-list">
        {#if selectedEstimate}<div>
            <dt>Estimate profile ID</dt>
            <dd>
              <code>{selectedEstimate.profileId}</code>
              <CopyButton value={selectedEstimate.profileId} label="estimate profile ID" />
            </dd>
          </div>{/if}
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
    <p>Select an item to inspect its context.</p>
  {/if}
</section>

<style>
  .item-details {
    color: #bdc7d8;
    min-width: 0;
  }
  .item-identity {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0 7px;
    background: var(--surface);
  }
  .item-identity > div {
    display: grid;
    min-width: 0;
    gap: 5px;
  }
  .item-identity span {
    display: inline-block;
    color: #b8c7e3;
    border: 1px solid #3a496a;
    border-radius: 999px;
    padding: 2px 7px;
    font-size: 12px;
  }
  h3 {
    color: #fff;
    font-size: 15px;
    margin: 0 0 6px;
    overflow-wrap: anywhere;
  }
  h3:focus {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
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
  .preview-note,
  .presence-note {
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
  .preview-toggle {
    display: block;
    width: fit-content;
    margin: 7px 0 0 auto;
    min-height: 28px;
    padding: 4px 8px;
    font-size: 11px;
    color: var(--secondary);
    background: transparent;
    border: 1px solid transparent;
  }
  .preview-toggle:hover {
    text-decoration: underline;
    background: var(--plot);
  }
  .preview-toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .preview-details pre {
    color: #e1e7f2;
    background: var(--plot);
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
    grid-template-columns: minmax(0, 1fr);
    gap: 7px 14px;
    margin: 10px 0 0;
  }
  dt {
    color: var(--secondary);
    font-size: 12px;
  }
  dd {
    margin: 1px 0 0;
    overflow-wrap: anywhere;
    color: #e2e8f3;
  }
  .essential-metrics dd small {
    display: block;
    margin-top: 2px;
    color: var(--secondary);
    font-size: 12px;
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
    color: var(--secondary);
    font-size: 12px;
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
