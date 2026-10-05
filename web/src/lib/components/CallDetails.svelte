<script context="module" lang="ts">
  let nextContributionId = 0;
</script>

<script lang="ts">
  import type { IndexedAnalysis, ModelCall } from '../types';
  import { displayItemLabel } from '../item-label';
  import { describeTokenDiagnostic } from '../diagnostics';
  import { describeEconomicsCode } from '../economics';
  import { describeCostBasis, isPiSource } from '../cost-basis';
  import CopyButton from './CopyButton.svelte';
  import ItemContribution from './ItemContribution.svelte';
  import { itemContributions } from './item-contribution';
  import { responseDuration, effectiveOutputRate, TIMING_EXPLANATION } from './call-timing';
  import {
    inspectorSections,
    rememberSection,
    type InspectorSections,
  } from '../state/inspector-sections';
  export let sections: InspectorSections = inspectorSections();
  const contributionId = `call-contribution-${nextContributionId++}`;
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
  export let onPinCall: (index: number) => void = () => {};

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
  $: economicsExplanationCodes = call?.economics.explanationCodes ?? [];
  $: costCopy = describeCostBasis(indexed.analysis.economics.costBasis);
  $: usageMappingLabel = isPiSource(indexed.analysis.session.source)
    ? 'audited Pi provider/API policy'
    : 'audited provider/API policy';
  $: tokenProfile = call?.tokenizationProfileId
    ? (indexed.analysis.tokenAnalysis.profiles.find(
        (profile) => profile.id === call?.tokenizationProfileId,
      ) ?? null)
    : null;

  $: previousCall = call
    ? (indexed.analysis.modelCalls[
        indexed.analysis.modelCalls.findIndex((value) => value.index === call?.index) - 1
      ] ?? null)
    : null;

  $: addedContributions = itemContributions(indexed, call?.addedItemIds ?? [], call, 'added');
  $: droppedContributions = itemContributions(
    indexed,
    call?.droppedItemIds ?? [],
    previousCall,
    'dropped',
  );

  function itemLabel(id: string): string {
    return displayItemLabel(indexed.itemById.get(id), id);
  }

  function methodLabel(method: string): string {
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

  function inputBucketLabel(policyId: string | null): string {
    if (policyId === 'anthropic-messages-cache-v1') return 'Fresh input';
    if (policyId === 'openai-completions-cache-v1') return 'Uncached input';
    if (
      policyId === 'openai-responses-cache-read-v1' ||
      policyId === 'openai-codex-responses-cache-read-v1'
    ) {
      return 'Non-cache-read input (may include writes)';
    }
    return 'Input (raw normalized bucket)';
  }

  function cacheWriteValue(): string {
    if (!call) return 'Unknown';
    switch (call.economics.cacheWriteStatus) {
      case 'reported':
        return formatMetric(call.usage.cacheWrite);
      case 'notReported':
        return 'Not separately reported';
      case 'notRetainedByPi':
        return isPiSource(indexed.analysis.session.source)
          ? 'Not retained by Pi'
          : 'Not retained by source';
      default:
        return `Raw normalized value: ${formatMetric(call.usage.cacheWrite)}`;
    }
  }

  function inputShareLabel(policyId: string | null): string {
    if (policyId === 'anthropic-messages-cache-v1') return 'Fresh-input share';
    if (policyId === 'openai-completions-cache-v1') return 'Uncached-input share';
    return 'Fresh / uncached input share';
  }

  function cacheWriteLabel(): string {
    if (!call) return 'Cache write';
    return call.economics.cacheWriteStatus === 'unsupported'
      ? 'Cache write (raw field)'
      : 'Cache write';
  }

  function ratioValue(value: number | null): string {
    if (value !== null) return formatPercent(value);
    if (!call) return 'Unknown';
    if (call.economics.usageCompleteness === 'unsupported') return 'Unsupported policy';
    if (call.economics.usageCompleteness === 'missing') return 'Provider usage missing';
    if (call.economics.usageCompleteness === 'partial') return 'Provider usage incomplete';
    if (call.economics.promptTokens === 0) return 'No prompt tokens';
    return 'Unavailable';
  }

  function cacheWriteShareValue(): string {
    if (!call) return 'Unknown';
    if (call.economics.cacheWriteStatus === 'notReported') return 'Not separately reported';
    if (call.economics.cacheWriteStatus === 'notRetainedByPi') {
      return isPiSource(indexed.analysis.session.source)
        ? 'Not retained by Pi'
        : 'Not retained by source';
    }
    if (call.economics.cacheWriteStatus === 'unsupported') return 'Unsupported policy';
    return ratioValue(call.economics.cacheWriteRatio);
  }

  function discontinuityPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  function freshRatioValue(): string {
    if (!call) return 'Unknown';
    if (
      call.economics.policyId === 'openai-responses-cache-read-v1' ||
      call.economics.policyId === 'openai-codex-responses-cache-read-v1'
    ) {
      return 'Unavailable; writes may be included in non-read input';
    }
    return ratioValue(call.economics.freshRatio);
  }
</script>

{#if call}
  <section class="call-details" aria-label={`${pinned ? 'Pinned' : 'Model'} call ${call.index}`}>
    <header>
      <div>
        <h3 id="pinned-call-summary" tabindex="-1">
          {pinned ? 'Pinned call' : 'Call'}
          {call.index}
        </h3>
        <span>{call.provider ?? 'Unknown provider'} / {call.model ?? 'Unknown model'}</span>
      </div>
      {#if onClose}<button type="button" aria-label="Close pinned call" onclick={onClose}>×</button
        >{/if}
    </header>

    <dl class="essential-metrics">
      <div>
        <dt>Input</dt>
        <dd>{formatMetric(call.reportedPromptTokens)}</dd>
      </div>
      <div>
        <dt>Output</dt>
        <dd>{formatMetric(call.reportedCompletionTokens)}</dd>
      </div>
      <div>
        <dt>{costCopy.label}</dt>
        <dd>
          {formatCost(call.cost?.total)}{#if call.economics.costCompleteness !== 'complete'}<small
              >Components: {call.economics.costCompleteness}</small
            >{/if}
        </dd>
      </div>
      <div>
        <dt>Provider usage</dt>
        <dd>
          {call.reportedUsageCompleteness}{#if call.economics.usageCompleteness !== call.reportedUsageCompleteness}<small
              >Audited policy: {call.economics.usageCompleteness}</small
            >{/if}
        </dd>
      </div>
      <div>
        <dt>Response time (approx.)</dt>
        <dd title={TIMING_EXPLANATION} aria-describedby={`${contributionId}-timing`}>
          {responseDuration(call.timing.durationMs)}
        </dd>
      </div>
      <div>
        <dt>Effective output rate</dt>
        <dd title={TIMING_EXPLANATION} aria-describedby={`${contributionId}-timing`}>
          {effectiveOutputRate(call.timing.effectiveOutputTokensPerSecond)}
        </dd>
      </div>
    </dl>
    <span class="timing-explanation" id={`${contributionId}-timing`}
      >{TIMING_EXPLANATION} Missing or unusable timestamps and unsuccessful-response rates are unavailable.</span
    >

    {#if call.addedItemIds.length > 0 || call.droppedItemIds.length > 0}
      <details use:rememberSection={{ state: sections, key: 'changes' }}>
        <summary
          >Context changes · {formatInteger(call.transitionItemCounts.added)} added / {formatInteger(
            call.transitionItemCounts.dropped,
          )} dropped</summary
        >
        <div
          class="change-lists"
          class:single={call.addedItemIds.length === 0 || call.droppedItemIds.length === 0}
        >
          {#if call.addedItemIds.length > 0}<div class="change-list">
              <h4>Added items ({formatInteger(call.addedItemIds.length)})</h4>
              <p class="change-baseline">Share of estimated added tokens</p>
              <ul role="list">
                {#each call.addedItemIds as id, rowIndex}
                  {@const contribution = addedContributions.get(id)!}
                  <li>
                    <button
                      type="button"
                      aria-label={`Select added item ${itemLabel(id)}`}
                      aria-describedby={`${contributionId}-added-${rowIndex}`}
                      title={`${itemLabel(id)} — ${contribution.detail}`}
                      onclick={() => onSelectItem(id)}
                      >{itemLabel(id)}<ItemContribution
                        value={contribution}
                        descriptionId={`${contributionId}-added-${rowIndex}`}
                      /></button
                    >
                  </li>{/each}
              </ul>
            </div>{/if}
          {#if call.droppedItemIds.length > 0}<div class="change-list">
              <h4>Dropped items ({formatInteger(call.droppedItemIds.length)})</h4>
              <p class="change-baseline">
                {#if previousCall}Share of estimated dropped tokens · previous call {previousCall.index}{:else}Previous
                  call unavailable{/if}
              </p>
              <ul role="list">
                {#each call.droppedItemIds as id, rowIndex}
                  {@const contribution = droppedContributions.get(id)!}
                  <li>
                    <button
                      type="button"
                      aria-label={`Select dropped item ${itemLabel(id)}`}
                      aria-describedby={`${contributionId}-dropped-${rowIndex}`}
                      title={`${itemLabel(id)} — ${contribution.detail}`}
                      onclick={() => onSelectItem(id)}
                      >{itemLabel(id)}<ItemContribution
                        value={contribution}
                        descriptionId={`${contributionId}-dropped-${rowIndex}`}
                      /></button
                    >
                  </li>{/each}
              </ul>
            </div>{/if}
        </div>
      </details>
    {:else}
      <p>
        Context changes · {formatInteger(call.transitionItemCounts.added)} added / {formatInteger(
          call.transitionItemCounts.dropped,
        )} dropped
      </p>
    {/if}
    {#if compaction}<p>
        Compaction · {formatInteger(compaction.sourceItemIds.length)} structurally replaced / {formatInteger(
          compaction.retainedItemIds.length,
        )} retained
      </p>{/if}

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

    <details class="usage-breakdown" use:rememberSection={{ state: sections, key: 'usage' }}>
      <summary>Usage and economics</summary>
      <p class="economics-note">
        Token buckets follow the {usageMappingLabel} when supported; normalized zeros may reflect adapter
        defaults. {costCopy.note} Cache write 1h is retained source detail and is not added to aggregate
        cache-write totals.
      </p>
      <dl class="detail-rows">
        <div>
          <dt>{inputBucketLabel(call.economics.policyId)}</dt>
          <dd>{formatMetric(call.usage.input)}</dd>
        </div>
        <div>
          <dt>{call.economics.policyId ? 'Cache read' : 'Cache read (raw field)'}</dt>
          <dd>{formatMetric(call.usage.cacheRead)}</dd>
        </div>
        <div>
          <dt>{cacheWriteLabel()}</dt>
          <dd>{cacheWriteValue()}</dd>
        </div>
        <div>
          <dt>Cache write 1h (source detail)</dt>
          <dd>{formatMetric(call.usage.cacheWrite1h)}</dd>
        </div>
        <div>
          <dt>Audited usage completeness</dt>
          <dd>{call.economics.usageCompleteness}</dd>
        </div>
        <div>
          <dt>Audited prompt total</dt>
          <dd>{formatMetric(call.economics.promptTokens)}</dd>
        </div>
        <div>
          <dt>Cache-read share</dt>
          <dd>{ratioValue(call.economics.cacheReadRatio)}</dd>
        </div>
        <div>
          <dt>Cache-write share</dt>
          <dd>{cacheWriteShareValue()}</dd>
        </div>
        <div>
          <dt>{inputShareLabel(call.economics.policyId)}</dt>
          <dd>{freshRatioValue()}</dd>
        </div>
        <div>
          <dt>{costCopy.label} component completeness</dt>
          <dd>{call.economics.costCompleteness}</dd>
        </div>
        <div>
          <dt>{costCopy.promptLabel}</dt>
          <dd>{formatCost(call.economics.piPromptCost)}</dd>
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
          <dt>{costCopy.componentPrefix} input cost</dt>
          <dd>{formatCost(call.cost?.input)}</dd>
        </div>
        <div>
          <dt>{costCopy.componentPrefix} output cost</dt>
          <dd>{formatCost(call.cost?.output)}</dd>
        </div>
        <div>
          <dt>{costCopy.componentPrefix} cache-read cost</dt>
          <dd>{formatCost(call.cost?.cacheRead)}</dd>
        </div>
        <div>
          <dt>{costCopy.componentPrefix} cache-write cost</dt>
          <dd>{formatCost(call.cost?.cacheWrite)}</dd>
        </div>
        <div>
          <dt>{costCopy.totalLabel}</dt>
          <dd>{formatCost(call.cost?.total)}</dd>
        </div>
      </dl>
      {#if call.economics.cacheRatioDiscontinuity}
        {@const change = call.economics.cacheRatioDiscontinuity}
        <div class="ratio-discontinuity" role="note">
          <b
            >Cache-read share {change.direction === 'drop' ? 'dropped' : 'rose'} from {discontinuityPercent(
              change.previousRatio,
            )} on call {change.previousCallIndex} to {discontinuityPercent(change.currentRatio)} on call
            {call.index}</b
          >
          <p>
            Adjacent-call change: {formatInteger(change.previousPromptTokens)} to
            {formatInteger(change.currentPromptTokens)} prompt tokens; change of
            {(change.delta * 100).toFixed(1)} percentage points ({change.magnitude}). Method:
            {change.method}.
            {#if change.compactionBefore}Compaction {change.compactionBefore} is nearby context.{/if}
          </p>
          <button type="button" onclick={() => onPinCall(change.previousCallIndex)}>
            Inspect previous call {change.previousCallIndex}
          </button>
        </div>
      {/if}
      {#if economicsExplanationCodes.length > 0}
        <h4>Economics notes</h4>
        <ul class="economics-explanations">
          {#each economicsExplanationCodes as code (code)}
            {@const description = describeEconomicsCode(
              code,
              indexed.analysis.economics.costBasis,
              indexed.analysis.session.source,
            )}
            <li>
              {#if description}<b>{description.title}</b> — {description.impact}
              {:else}<b>Unrecognized economics explanation</b> — see the raw code in Technical identifiers.{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </details>

    <details
      class="token-diagnostics"
      use:rememberSection={{ state: sections, key: 'diagnostics' }}
    >
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
          <dt>Model / tokenizer</dt>
          <dd>
            {#if tokenProfile}
              {tokenProfile.provider} / {tokenProfile.model} · {methodLabel(tokenProfile.method)}
            {:else if call.tokenizationProfileId}
              Tokenizer profile unavailable · {call.tokenizationProfileId}
            {:else}
              Unavailable
            {/if}
          </dd>
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

    <details
      class="technical-identifiers"
      use:rememberSection={{ state: sections, key: 'identifiers' }}
    >
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
        {#if call.economics.policyId}<div>
            <dt>Economics policy ID</dt>
            <dd>
              <code>{call.economics.policyId}</code>
              <CopyButton value={call.economics.policyId} label="economics policy ID" />
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
      {#if economicsExplanationCodes.length > 0}
        <h4>Raw economics codes</h4>
        <ul>
          {#each economicsExplanationCodes as code (code)}<li><code>{code}</code></li>{/each}
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
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
    margin: -2px 0 8px;
    padding: 4px 0 7px;
    background: var(--surface);
  }
  header div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  header h3 {
    margin: 0;
    color: var(--text);
    font-size: 15px;
  }
  header h3:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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
  .timing-explanation {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  dt {
    color: var(--secondary);
    font-size: 12px;
  }
  dd {
    margin: 1px 0 0;
    color: #eef2f8;
    overflow-wrap: anywhere;
  }
  dd small {
    display: block;
    color: var(--secondary);
    font-size: 12px;
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
  .change-list {
    min-width: 0;
  }
  .change-lists h4 {
    margin-top: 0;
  }
  .change-lists ul {
    list-style: none;
    padding-left: 0;
  }
  .change-lists button {
    width: 100%;
    text-align: left;
  }
  .change-baseline {
    margin: 0 0 6px;
    color: var(--secondary);
    font-size: 11px;
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
    gap: 4px 12px;
    margin-top: 4px;
  }
  .tool-chip {
    display: inline;
    color: #aebbd0;
    font-size: 12px;
    cursor: default;
  }
  .tool-chip.failed {
    color: #ffc0ae;
  }
  .detail-rows,
  .technical-values {
    margin-top: 8px;
  }
  .economics-note,
  .economics-explanations {
    color: #aebbd0;
    font-size: 12px;
    line-height: 1.4;
  }
  .economics-note {
    margin: 6px 0;
  }
  .ratio-discontinuity {
    margin-top: 9px;
    padding: 8px 10px;
    border-left: 3px solid #ffbd64;
    border-radius: 4px;
    background: #1b1c2a;
    color: #e4e8f1;
    font-size: 12px;
  }
  .ratio-discontinuity p {
    margin: 4px 0 7px;
    color: #bac5d8;
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
