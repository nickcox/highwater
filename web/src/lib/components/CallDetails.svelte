<script lang="ts">
  import type { IndexedAnalysis, ModelCall } from '../types';
  import { coverageLabel, formatCost, formatMetric, formatPercent } from '../context-river/format';

  export let call: ModelCall | null;
  export let indexed: IndexedAnalysis;
  export let pinned = false;
  export let compact = false;
  export let onSelectItem: (id: string) => void = () => {};
  export let onClose: (() => void) | null = null;

  $: compaction = call?.compactionBefore
    ? indexed.compactionById.get(call.compactionBefore) ?? null
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

  function itemLabel(id: string): string {
    const item = indexed.itemById.get(id);
    return item?.preview?.text || item?.label || id;
  }
</script>

{#if call}
  <section class:compact class="call-details" aria-label={`${pinned ? 'Pinned' : 'Model'} call ${call.index}`}>
    <header>
      <div>
        <strong>{pinned ? 'Pinned call' : 'Call'} {call.index}</strong>
        <span>{call.provider ?? 'Unknown provider'} / {call.model ?? 'Unknown model'}</span>
      </div>
      {#if onClose}<button type="button" aria-label="Close pinned call" onclick={onClose}>×</button>{/if}
    </header>
    <h4>Provider reported</h4>
    <dl class="metrics">
      <div><dt>Prompt</dt><dd>{formatMetric(call.reportedPromptTokens)}</dd></div>
      <div><dt>Fresh input</dt><dd>{formatMetric(call.usage.input)}</dd></div>
      <div><dt>Cache read</dt><dd>{formatMetric(call.usage.cacheRead)}</dd></div>
      <div><dt>Cache write</dt><dd>{formatMetric(call.usage.cacheWrite)}</dd></div>
      <div><dt>Cache write 1h</dt><dd>{formatMetric(call.usage.cacheWrite1h)}</dd></div>
      <div><dt>Output</dt><dd>{formatMetric(call.usage.output)}</dd></div>
      <div><dt>Reasoning</dt><dd>{formatMetric(call.usage.reasoning)}</dd></div>
      <div><dt>Usage completeness</dt><dd>{call.reportedUsageCompleteness}</dd></div>
      <div><dt>Cumulative prompt</dt><dd>{formatMetric(call.cumulativeReportedPromptTokens)}</dd></div>
      <div><dt>Cumulative output</dt><dd>{formatMetric(call.cumulativeReportedCompletionTokens)}</dd></div>
      <div><dt>Cumulative usage</dt><dd>{call.cumulativeReportedUsageCompleteness}</dd></div>
      <div><dt>Cost input</dt><dd>{formatCost(call.cost?.input)}</dd></div>
      <div><dt>Cost output</dt><dd>{formatCost(call.cost?.output)}</dd></div>
      <div><dt>Cost cache read</dt><dd>{formatCost(call.cost?.cacheRead)}</dd></div>
      <div><dt>Cost cache write</dt><dd>{formatCost(call.cost?.cacheWrite)}</dd></div>
      <div><dt>Cost total</dt><dd>{formatCost(call.cost?.total)}</dd></div>
    </dl>
    <h4>Calculated composition</h4>
    <dl class="metrics calculated">
      <div><dt>Visible context</dt><dd>{formatMetric(call.tokenAnalysis.calculatedVisibleTokens)}</dd></div>
      <div><dt>Known framing</dt><dd>{formatMetric(call.tokenAnalysis.knownFramingOverheadTokens)}</dd></div>
      <div><dt>Residual</dt><dd>{formatMetric(call.tokenAnalysis.residualTokens)} ({formatPercent(call.tokenAnalysis.residualPercent)})</dd></div>
      <div><dt>Coverage</dt><dd>{coverageLabel(call.tokenAnalysis.estimateCoverage.completeItems, call.tokenAnalysis.estimateCoverage.totalItems)}</dd></div>
      <div><dt>Status</dt><dd>{call.tokenAnalysis.status}</dd></div>
      <div><dt>Method profile</dt><dd>{call.tokenizationProfileId ?? 'Unavailable'}</dd></div>
      <div><dt>Oldest live age</dt><dd>{formatMetric(call.tokenAnalysis.age.oldestLiveItemAgeCalls)} calls</dd></div>
      <div><dt>Median live age</dt><dd>{formatMetric(call.tokenAnalysis.age.medianLiveItemAgeCalls)} calls</dd></div>
      <div><dt>Token-weighted age</dt><dd>{formatMetric(call.tokenAnalysis.age.tokenWeightedMeanAgeCalls)} calls</dd></div>
      <div><dt>Age ≥5 / ≥10 / ≥20</dt><dd>{call.tokenAnalysis.age.itemsAtLeast5CallsOld} / {call.tokenAnalysis.age.itemsAtLeast10CallsOld} / {call.tokenAnalysis.age.itemsAtLeast20CallsOld} items</dd></div>
    </dl>
    <p class="delta">Since previous call: {call.transitionItemCounts.added} added · {call.transitionItemCounts.retained} retained · {call.transitionItemCounts.dropped} dropped · calculated churn {formatPercent(call.tokenAnalysis.churn)}</p>
    <p class="delta">Calculated tokens: {formatMetric(call.tokenAnalysis.addedTokens)} added · {formatMetric(call.tokenAnalysis.retainedTokens)} retained · {formatMetric(call.tokenAnalysis.droppedTokens)} dropped</p>
    {#if call.tokenAnalysis.explanationCodes.length > 0}<p class="diagnostics"><b>Diagnostics:</b> {call.tokenAnalysis.explanationCodes.join(', ')}</p>{/if}
    {#if call.toolCallsAfter.length > 0}
      <div class="subsection"><b>Tools invoked after this response</b>
        <div class="tool-list">
          {#each toolSummaries as tool}
            <span class="tool-chip" class:failed={tool.failed} title={tool.failed ? `${tool.name} failed` : tool.name}>
              {tool.name}{tool.count > 1 ? ` × ${tool.count}` : ''}{tool.failed ? ' · failed' : ''}
            </span>
          {/each}
        </div>
        {#if !compact}
          <details class="technical-tools">
            <summary>Technical tool-call IDs</summary>
            <ul>{#each call.toolCallsAfter as tool}<li>{tool.name} <code>{tool.id}</code>{#if tool.failed}<span class="error-mark">failed</span>{/if}</li>{/each}</ul>
          </details>
        {/if}
      </div>
    {/if}
    <p><b>Stop reason:</b> {call.stopReason ?? 'Unknown'}</p>
    {#if compaction}<p class="compaction"><b>Compaction before this call</b> · {compaction.sourceItemIds.length} structurally replaced · {compaction.retainedItemIds.length} retained</p>{/if}
    {#if !compact}
      <div class="lists">
        <div><b>Added items</b>{#if call.addedItemIds.length === 0}<p>None</p>{:else}{#each call.addedItemIds as id}<button type="button" onclick={() => onSelectItem(id)}>{itemLabel(id)}</button>{/each}{/if}</div>
        <div><b>Dropped items</b>{#if call.droppedItemIds.length === 0}<p>None</p>{:else}{#each call.droppedItemIds as id}<button type="button" onclick={() => onSelectItem(id)}>{itemLabel(id)}</button>{/each}{/if}</div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .call-details { color: #c3ccdc; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: start; margin-bottom: 10px; }
  header div { display: flex; flex-direction: column; gap: 2px; }
  header strong { color: #fff; font-size: 15px; }
  header span { color: #909db4; font-size: 12px; }
  header button { font-size: 18px; padding: 1px 7px; }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(90px, 1fr)); gap: 7px; margin: 0; }
  .metrics div { background: #0b1223; border-radius: 6px; padding: 6px 8px; }
  h4 { margin: 12px 0 6px; color: #c8d5ed; font-size: 12px; }
  dt { color: #8996ad; font-size: 11px; }
  dd { margin: 1px 0 0; color: #eef2f8; overflow-wrap: anywhere; }
  .diagnostics { color: #d5bf9f; font-size: 12px; }
  p { margin: 8px 0 0; }
  .delta { color: #aebbd0; }
  .subsection { margin-top: 10px; }
  .tool-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .tool-chip { display: inline-flex; align-items: center; border: 1px solid #3a496a; border-radius: 999px; padding: 3px 8px; color: #d8e2f4; background: #151e35; font-size: 12px; }
  .tool-chip.failed { border-color: #a45d50; color: #ffc0ae; }
  .technical-tools { margin-top: 7px; color: #9aa8bd; font-size: 12px; }
  .technical-tools summary { cursor: pointer; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  code { color: #8fa2c5; overflow-wrap: anywhere; }
  .error-mark { color: #ff9f7a; margin-left: 6px; }
  .compaction { border-left: 3px dashed #ffb14e; padding-left: 8px; }
  .lists { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .lists > div { display: flex; flex-direction: column; gap: 5px; }
  .lists button { text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lists p { color: #8390a7; }
  .compact { background: #090e1b; border: 1px solid #405077; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.4); padding: 10px; min-width: 300px; }
  .compact .metrics { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 650px) { .metrics { grid-template-columns: repeat(2, 1fr); } .lists { grid-template-columns: 1fr; } }
</style>
