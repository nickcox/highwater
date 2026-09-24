<script lang="ts">
  import type { IndexedAnalysis, ModelCall } from '../types';
  import { displayItemLabel } from '../item-label';
  import { describeTokenDiagnostic } from '../diagnostics';
  import CopyButton from './CopyButton.svelte';
  import {
    coverageLabel,
    formatCost,
    formatInteger,
    formatMetric,
    formatPercent,
  } from '../context-river/format';

  export let call: ModelCall | null;
  export let indexed: IndexedAnalysis;
  export let pinned = false;
  export let onSelectItem: (id: string) => void = () => {};
  export let onClose: (() => void) | null = null;

  $: compaction = call?.compactionBefore
    ? (indexed.compactionById.get(call.compactionBefore) ?? null)
    : null;
  $: toolSummaries = (() => {
    const summary = new Map<string, { count: number; failed: boolean }>();
    for (const tool of call?.toolCallsAfter ?? []) {
      const current = summary.get(tool.name) ?? { count: 0, failed: false };
      summary.set(tool.name, {
        count: current.count + 1,
        failed: current.failed || tool.failed,
      });
    }
    return [...summary.entries()].map(([name, value]) => ({ name, ...value }));
  })();
  $: explanationCodes = call?.tokenAnalysis.explanationCodes ?? [];

  function itemLabel(id: string): string {
    return displayItemLabel(indexed.itemById.get(id), id);
  }
</script>

{#if call}
  <section class="call-details" aria-label={`${pinned ? 'Pinned' : 'Model'} call ${call.index}`}>
    <header>
      <div>
        <strong>{pinned ? 'Pinned call' : 'Call'} {call.index}</strong>
        <span>{call.provider ?? 'Unknown provider'} / {call.model ?? 'Unknown model'}</span>
      </div>
      {#if onClose}<button type="button" aria-label="Close pinned call" onclick={onClose}>×</button
        >{/if}
    </header>

    <dl class="essential-metrics">
      <div>
        <dt>Prompt</dt>
        <dd>{formatMetric(call.reportedPromptTokens)}</dd>
      </div>
      <div>
        <dt>Output</dt>
        <dd>{formatMetric(call.reportedCompletionTokens)}</dd>
      </div>
      <div>
        <dt>Reported cost</dt>
        <dd>{formatCost(call.cost?.total)}</dd>
      </div>
      <div>
        <dt>Provider usage</dt>
        <dd>{call.reportedUsageCompleteness}</dd>
      </div>
      <div>
        <dt>Added items</dt>
        <dd>{formatInteger(call.transitionItemCounts.added)}</dd>
      </div>
      <div>
        <dt>Dropped items</dt>
        <dd>{formatInteger(call.transitionItemCounts.dropped)}</dd>
      </div>
    </dl>

    {#if call.addedItemIds.length > 0 || call.droppedItemIds.length > 0}
      <div
        class="change-lists"
        class:single={call.addedItemIds.length === 0 || call.droppedItemIds.length === 0}
      >
        {#if call.addedItemIds.length > 0}<details>
            <summary>Added items ({formatInteger(call.addedItemIds.length)})</summary>
            <ul>
              {#each call.addedItemIds as id}<li>
                  <button
                    type="button"
                    aria-label={`Select added item ${itemLabel(id)}`}
                    title={itemLabel(id)}
                    onclick={() => onSelectItem(id)}>{itemLabel(id)}</button
                  >
                </li>{/each}
            </ul>
          </details>{/if}
        {#if call.droppedItemIds.length > 0}<details>
            <summary>Dropped items ({formatInteger(call.droppedItemIds.length)})</summary>
            <ul>
              {#each call.droppedItemIds as id}<li>
                  <button
                    type="button"
                    aria-label={`Select dropped item ${itemLabel(id)}`}
                    title={itemLabel(id)}
                    onclick={() => onSelectItem(id)}>{itemLabel(id)}</button
                  >
                </li>{/each}
            </ul>
          </details>{/if}
      </div>
    {/if}

    {#if toolSummaries.length > 0}
      <div class="tool-summary">
        <b>Tools invoked after this response</b>
        <div class="tool-list">
          {#each toolSummaries as tool}
            <span class="tool-chip" class:failed={tool.failed}>
              {tool.name}{tool.count > 1 ? ` × ${tool.count}` : ''}{tool.failed ? ' · failed' : ''}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <details class="usage-breakdown">
      <summary>Usage breakdown</summary>
      <dl class="detail-rows">
        <div>
          <dt>Fresh input</dt>
          <dd>{formatMetric(call.usage.input)}</dd>
        </div>
        <div>
          <dt>Cache read</dt>
          <dd>{formatMetric(call.usage.cacheRead)}</dd>
        </div>
        <div>
          <dt>Cache write</dt>
          <dd>{formatMetric(call.usage.cacheWrite)}</dd>
        </div>
        <div>
          <dt>Cache write 1h</dt>
          <dd>{formatMetric(call.usage.cacheWrite1h)}</dd>
        </div>
        <div>
          <dt>Reported total tokens</dt>
          <dd>{formatMetric(call.reportedTotalTokens)}</dd>
        </div>
        <div>
          <dt>Cumulative prompt</dt>
          <dd>{formatMetric(call.cumulativeReportedPromptTokens)}</dd>
        </div>
        <div>
          <dt>Cumulative output</dt>
          <dd>{formatMetric(call.cumulativeReportedCompletionTokens)}</dd>
        </div>
        <div>
          <dt>Cumulative reasoning</dt>
          <dd>{formatMetric(call.cumulativeReportedReasoningTokens)}</dd>
        </div>
        <div>
          <dt>Cumulative usage completeness</dt>
          <dd>{call.cumulativeReportedUsageCompleteness}</dd>
        </div>
        <div>
          <dt>Cost input</dt>
          <dd>{formatCost(call.cost?.input)}</dd>
        </div>
        <div>
          <dt>Cost output</dt>
          <dd>{formatCost(call.cost?.output)}</dd>
        </div>
        <div>
          <dt>Cost cache read</dt>
          <dd>{formatCost(call.cost?.cacheRead)}</dd>
        </div>
        <div>
          <dt>Cost cache write</dt>
          <dd>{formatCost(call.cost?.cacheWrite)}</dd>
        </div>
        <div>
          <dt>Cost total</dt>
          <dd>{formatCost(call.cost?.total)}</dd>
        </div>
      </dl>
    </details>

    <details class="token-diagnostics">
      <summary>Token estimates and diagnostics</summary>
      <dl class="detail-rows">
        <div>
          <dt>Visible context</dt>
          <dd>{formatMetric(call.tokenAnalysis.calculatedVisibleTokens)}</dd>
        </div>
        <div>
          <dt>Known framing</dt>
          <dd>{formatMetric(call.tokenAnalysis.knownFramingOverheadTokens)}</dd>
        </div>
        <div>
          <dt>Calculated request</dt>
          <dd>{formatMetric(call.tokenAnalysis.calculatedRequestTokens)}</dd>
        </div>
        <div>
          <dt>Residual</dt>
          <dd>
            {formatMetric(call.tokenAnalysis.residualTokens)} ({formatPercent(
              call.tokenAnalysis.residualPercent,
            )})
          </dd>
        </div>
        <div>
          <dt>Estimate coverage</dt>
          <dd>
            {coverageLabel(
              call.tokenAnalysis.estimateCoverage.completeItems,
              call.tokenAnalysis.estimateCoverage.totalItems,
            )}
            items complete · {formatInteger(call.tokenAnalysis.estimateCoverage.partialItems)} partial
            · {formatInteger(call.tokenAnalysis.estimateCoverage.unavailableItems)} unavailable
          </dd>
        </div>
        <div>
          <dt>Reconciliation status</dt>
          <dd>{call.tokenAnalysis.status}</dd>
        </div>
        <div>
          <dt>Method profile</dt>
          <dd>{call.tokenizationProfileId ?? 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Added tokens</dt>
          <dd>{formatMetric(call.tokenAnalysis.addedTokens)}</dd>
        </div>
        <div>
          <dt>Retained tokens</dt>
          <dd>{formatMetric(call.tokenAnalysis.retainedTokens)}</dd>
        </div>
        <div>
          <dt>Dropped tokens</dt>
          <dd>{formatMetric(call.tokenAnalysis.droppedTokens)}</dd>
        </div>
        <div>
          <dt>Calculated churn</dt>
          <dd>{formatPercent(call.tokenAnalysis.churn)}</dd>
        </div>
        <div>
          <dt>Calculated reuse</dt>
          <dd>{formatPercent(call.tokenAnalysis.reuse)}</dd>
        </div>
        <div>
          <dt>Addition share</dt>
          <dd>{formatPercent(call.tokenAnalysis.additionShare)}</dd>
        </div>
        <div>
          <dt>Removal share</dt>
          <dd>{formatPercent(call.tokenAnalysis.removalShare)}</dd>
        </div>
        <div>
          <dt>Oldest / median live age</dt>
          <dd>
            {formatMetric(call.tokenAnalysis.age.oldestLiveItemAgeCalls)} /
            {formatMetric(call.tokenAnalysis.age.medianLiveItemAgeCalls)} calls
          </dd>
        </div>
        <div>
          <dt>Token-weighted mean age</dt>
          <dd>{formatMetric(call.tokenAnalysis.age.tokenWeightedMeanAgeCalls)} calls</dd>
        </div>
        <div>
          <dt>Items aged ≥5 / ≥10 / ≥20 calls</dt>
          <dd>
            {formatInteger(call.tokenAnalysis.age.itemsAtLeast5CallsOld)} /
            {formatInteger(call.tokenAnalysis.age.itemsAtLeast10CallsOld)} /
            {formatInteger(call.tokenAnalysis.age.itemsAtLeast20CallsOld)}
          </dd>
        </div>
        <div>
          <dt>Transition counts</dt>
          <dd>
            {formatInteger(call.transitionItemCounts.added)} added ·
            {formatInteger(call.transitionItemCounts.retained)} retained ·
            {formatInteger(call.transitionItemCounts.dropped)} dropped
          </dd>
        </div>
      </dl>
      {#if explanationCodes.length > 0}
        <h4>Diagnostic explanations</h4>
        <ul class="diagnostics">
          {#each explanationCodes as code (code)}
            {@const description = describeTokenDiagnostic(code)}
            <li>
              {#if description}<b>{description.title}</b> — {description.impact}
              {:else}<b>Unrecognized diagnostic</b> — see the raw code in Technical identifiers.{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </details>

    <details class="technical-identifiers">
      <summary>Technical identifiers</summary>
      <dl class="identifier-list">
        <div>
          <dt>Source record ID</dt>
          <dd>
            <code>{call.sourceRecordId}</code>
            <CopyButton value={call.sourceRecordId} label="source record ID" />
          </dd>
        </div>
        {#if call.tokenizationProfileId}<div>
            <dt>Tokenization profile ID</dt>
            <dd>
              <code>{call.tokenizationProfileId}</code>
              <CopyButton value={call.tokenizationProfileId} label="tokenization profile ID" />
            </dd>
          </div>{/if}
      </dl>
      <dl class="technical-values">
        <div>
          <dt>Stop reason</dt>
          <dd>{call.stopReason ?? 'Unknown'}</dd>
        </div>
        {#if compaction}<div>
            <dt>Compaction before this call</dt>
            <dd>
              {formatInteger(compaction.sourceItemIds.length)} structurally replaced ·
              {formatInteger(compaction.retainedItemIds.length)} retained
            </dd>
          </div>
          <div>
            <dt>Compaction ID</dt>
            <dd><code>{compaction.id}</code></dd>
          </div>{/if}
      </dl>
      {#if toolSummaries.length > 0}
        <h4>Tool-call IDs</h4>
        <ul class="tool-identifiers">
          {#each call.toolCallsAfter as tool (tool.id)}
            <li>
              {tool.name} <code>{tool.id}</code>
              <CopyButton value={tool.id} label={`${tool.name} tool-call ID`} />
              {#if tool.failed}<span class="error-mark">failed</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if explanationCodes.length > 0}
        <h4>Raw diagnostic codes</h4>
        <ul>
          {#each explanationCodes as code (code)}<li><code>{code}</code></li>{/each}
        </ul>
      {/if}
    </details>
  </section>
{/if}

<style>
  .call-details {
    color: #c3ccdc;
    min-width: 0;
    max-width: 100%;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
    margin-bottom: 8px;
  }
  header div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  header strong {
    color: #fff;
    font-size: 15px;
  }
  header span {
    color: #aebbd0;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  header button {
    font-size: 18px;
    padding: 1px 7px;
  }
  .essential-metrics,
  .detail-rows,
  .technical-values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 14px;
    margin: 0;
  }
  dt {
    color: #8996ad;
    font-size: 11px;
  }
  dd {
    margin: 1px 0 0;
    color: #eef2f8;
    overflow-wrap: anywhere;
  }
  .change-lists {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 14px;
    margin-top: 10px;
  }
  .change-lists.single {
    grid-template-columns: minmax(0, 1fr);
  }
  details {
    margin-top: 10px;
    min-width: 0;
  }
  .change-lists details {
    margin-top: 0;
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
  .tool-summary {
    margin-top: 10px;
  }
  .tool-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .tool-chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid #3a496a;
    border-radius: 999px;
    padding: 3px 8px;
    color: #d8e2f4;
    background: #151e35;
    font-size: 12px;
  }
  .tool-chip.failed {
    border-color: #a45d50;
    color: #ffc0ae;
  }
  .detail-rows,
  .technical-values {
    margin-top: 8px;
  }
  h4 {
    margin: 11px 0 4px;
    color: #c8d5ed;
    font-size: 12px;
  }
  ul {
    margin: 4px 0 0;
    padding-left: 18px;
    overflow-wrap: anywhere;
  }
  .diagnostics {
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
  .tool-identifiers li {
    margin-top: 5px;
  }
  code {
    color: #9fb2d5;
    overflow-wrap: anywhere;
    user-select: all;
  }
  button:not(.copy-control button) {
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .error-mark {
    color: #ff9f7a;
    margin-left: 6px;
  }
  @media (max-width: 520px) {
    .essential-metrics,
    .detail-rows,
    .technical-values,
    .change-lists {
      grid-template-columns: 1fr;
    }
  }
</style>
