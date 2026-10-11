<script context="module" lang="ts">
  let nextContributionId = 0;

  // Mark token-based metrics that include partial item estimates.
  function approximate(
    value: number | null,
    format: (value: number | null | undefined) => string,
    includesPartialEstimates: boolean,
  ): string {
    const text = format(value);
    return value !== null && includesPartialEstimates ? `≈ ${text}` : text;
  }
</script>

<script lang="ts">
  import { claudeEstimateNote } from '../token-estimate';
  import type { IndexedAnalysis, ModelCall } from '../types';
  import { displayItemLabel } from '../item-label';
  import { describeTokenDiagnostic } from '../diagnostics';
  import { describeEconomicsCode } from '../economics';
  import { describeCostBasis, isPiSource } from '../cost-basis';
  import {
    costKindLabel,
    costRateLine,
    costRuleText,
    formatAssessedCost,
    RANGE_EXPLANATION,
    recordedByHarnessLine,
  } from '../cost-assessment';
  import { recordedResponseMetrics, outputAccountingLabel } from '../recorded-usage';
  import CopyButton from './CopyButton.svelte';
  import ItemContribution from './ItemContribution.svelte';
  import { callInputComparison } from '../context-river/reported-input';
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
  $: partialMetrics = call?.tokenAnalysis.metricsIncludePartialEstimates ?? false;
  $: inputComparison = call ? callInputComparison(indexed, call) : null;
  export let indexed: IndexedAnalysis;
  export let pinned = false;
  export let onSelectItem: (id: string) => void = () => {};
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
  $: recordedMetrics = call ? recordedResponseMetrics(call.usage) : [];
  $: explanationCodes = call?.tokenAnalysis.explanationCodes ?? [];
  $: economicsExplanationCodes = call?.economics.explanationCodes ?? [];
  $: costCopy = describeCostBasis(
    indexed.analysis.economics.costBasis,
    indexed.analysis.session.source,
  );
  $: costAssessment = call?.costAssessment ?? null;
  $: costRate = costAssessment ? costRateLine(costAssessment) : null;
  $: costRecorded = costAssessment
    ? recordedByHarnessLine(costAssessment, indexed.analysis.session.source)
    : null;
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
      case 'reportedUsage':
        return 'Reported thinking size';
      default:
        return 'Unavailable estimate method';
    }
  }

  function inputBucketLabel(policyId: string | null): string {
    if (
      policyId === 'anthropic-messages-cache-v1' ||
      policyId === 'github-copilot-responses-cache-v1'
    )
      return 'Fresh input';
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
    if (
      policyId === 'anthropic-messages-cache-v1' ||
      policyId === 'github-copilot-responses-cache-v1'
    )
      return 'Fresh-input share';
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
    </header>

    <dl class="essential-metrics">
      <div>
        <dt>Input</dt>
        <dd>{call.usage.placeholder ? 'Unavailable' : formatMetric(call.reportedPromptTokens)}</dd>
      </div>
      {#each recordedMetrics as metric}
        <div>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      {/each}
      <div>
        <dt>Cost</dt>
        <dd aria-describedby={`${contributionId}-cost`}>
          {call.usage.placeholder ? 'Unavailable' : formatAssessedCost(call.costAssessment)}<small
            >{costKindLabel(call.costAssessment)}</small
          >
        </dd>
      </div>
      <div>
        <dt>Provider usage</dt>
        <dd>
          {call.usage.placeholder
            ? 'Unavailable'
            : call.reportedUsageCompleteness}{#if call.economics.usageCompleteness !== call.reportedUsageCompleteness}<small
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
    <div class="cost-explanation" id={`${contributionId}-cost`}>
      <p>{costRuleText(call.costAssessment, indexed.analysis.session.source)}</p>
      {#if call.costAssessment.amountHigh !== null}<p>{RANGE_EXPLANATION}</p>{/if}
      {#if costRate}<p>Rate: {costRate}.</p>{/if}
      {#if costRecorded}<p>{costRecorded}</p>{/if}
    </div>

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
      {#if call.usage.placeholder}
        {@const raw = call.usage.placeholder}
        <p class="economics-note">
          Failed or aborted attempt: recorded zeros are placeholders, not measured usage. Actual
          token consumption and cost are unavailable; partial output does not establish usage.
        </p>
        <h4>Raw recorded placeholders</h4>
        <dl class="detail-rows" aria-label="Raw recorded placeholders">
          {#each [['Input', raw.input], ['Output', raw.output], ['Cache read', raw.cacheRead], ['Cache write', raw.cacheWrite], ['Cache write 1h', raw.cacheWrite1h], ['Reasoning', raw.reasoning], ['Total tokens', raw.totalTokens]] as [label, value]}
            <div>
              <dt>{label} (raw placeholder)</dt>
              <dd>{formatMetric(value as number | null)}</dd>
            </div>
          {/each}
          {#each [['Input', raw.cost?.input], ['Output', raw.cost?.output], ['Cache read', raw.cost?.cacheRead], ['Cache write', raw.cost?.cacheWrite], ['Total', raw.cost?.total]] as [label, value]}
            <div>
              <dt>{label} cost (raw placeholder)</dt>
              <dd>{formatCost(value as number | null | undefined)}</dd>
            </div>
          {/each}
        </dl>
      {/if}
      <p class="economics-note">
        Token buckets follow the {usageMappingLabel} when supported; normalized zeros may reflect adapter
        defaults. {costCopy.note} Cache write 1h is retained source detail and is not added to aggregate
        cache-write totals.
        {#if call.provider === 'github-copilot'}
          These dollar figures do not measure Copilot subscription charges or premium requests.
        {/if}
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
          <dt>Output accounting</dt>
          <dd>{outputAccountingLabel(call.usage.outputReasoningRelationship)}</dd>
        </div>
        <div>
          <dt>Completion total (including reasoning)</dt>
          <dd>{formatMetric(call.reportedCompletionTokens)}</dd>
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
          <dt>Cumulative completion (including reasoning)</dt>
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
        {#if call.tokenAnalysis.calculatedRequestTokens !== null}
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
        {:else if inputComparison}
          <div>
            <dt>Reported − reconstructed (approximate)</dt>
            <dd>
              {formatMetric(inputComparison.reported - inputComparison.reconstructed)} tokens
              {#if inputComparison.reported > 0}({formatPercent(
                  (inputComparison.reported - inputComparison.reconstructed) /
                    inputComparison.reported,
                )} of reported input){/if}
            </dd>
          </div>
        {/if}
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
        {#if call.tokenAnalysis.status !== 'unavailable'}
          <div>
            <dt>Reconciliation status</dt>
            <dd>{call.tokenAnalysis.status}</dd>
          </div>
        {/if}
        <div>
          <dt>Model / tokenizer</dt>
          <dd>
            {#if tokenProfile}
              {tokenProfile.provider} / {tokenProfile.model} · {methodLabel(tokenProfile.method)}
              {#if claudeEstimateNote(tokenProfile)}<small class="metric-note"
                  >{claudeEstimateNote(tokenProfile)}</small
                >{/if}
            {:else if call.tokenizationProfileId}
              Tokenizer profile unavailable · {call.tokenizationProfileId}
            {:else}
              Unavailable
            {/if}
          </dd>
        </div>
        <div>
          <dt>Added tokens</dt>
          <dd>{approximate(call.tokenAnalysis.addedTokens, formatMetric, partialMetrics)}</dd>
        </div>
        <div>
          <dt>Retained tokens</dt>
          <dd>{approximate(call.tokenAnalysis.retainedTokens, formatMetric, partialMetrics)}</dd>
        </div>
        <div>
          <dt>Dropped tokens</dt>
          <dd>{approximate(call.tokenAnalysis.droppedTokens, formatMetric, partialMetrics)}</dd>
        </div>
        <div>
          <dt>Calculated churn</dt>
          <dd>{approximate(call.tokenAnalysis.churn, formatPercent, partialMetrics)}</dd>
        </div>
        <div>
          <dt>Calculated reuse</dt>
          <dd>{approximate(call.tokenAnalysis.reuse, formatPercent, partialMetrics)}</dd>
        </div>
        <div>
          <dt>Addition share</dt>
          <dd>{approximate(call.tokenAnalysis.additionShare, formatPercent, partialMetrics)}</dd>
        </div>
        <div>
          <dt>Removal share</dt>
          <dd>{approximate(call.tokenAnalysis.removalShare, formatPercent, partialMetrics)}</dd>
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
          <dd>
            {approximate(
              call.tokenAnalysis.age.tokenWeightedMeanAgeCalls,
              formatMetric,
              partialMetrics,
            )} calls
          </dd>
        </div>
        {#if call.tokenAnalysis.metricsIncludePartialEstimates}
          <div>
            <dt>Estimate basis</dt>
            <dd>≈ values include items with partial token estimates, such as system prompts</dd>
          </div>
        {/if}
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
  .essential-metrics,
  .detail-rows,
  .technical-values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 14px;
    margin: 0;
  }
  .cost-explanation {
    margin: 2px 0 10px;
    color: var(--secondary);
    font-size: 12px;
  }
  .cost-explanation p {
    margin: 2px 0;
    overflow-wrap: anywhere;
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
