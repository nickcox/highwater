<script lang="ts">
  import type { IndexedAnalysis } from '../types';
  import { estimateSummary } from '../estimate-quality';
  import InfoPopover from './InfoPopover.svelte';
  import { describeCostBasis, isPiSource } from '../cost-basis';
  import { recordedCoverageNote } from '../recorded-usage';
  import {
    formatCostSubtotal,
    harnessName,
    harnessSessionCostNote,
    sessionCostCoverage,
    sessionCost,
  } from '../cost-assessment';
  import { summarizeInputComparisons } from '../context-river/reported-input';
  import {
    coverageLabel,
    formatCost,
    formatInteger,
    formatMetric,
    formatPercent,
    formatSessionCost,
    formatWeight,
  } from '../context-river/format';
  export let indexed: IndexedAnalysis;

  $: analysis = indexed.analysis;
  $: session = analysis.session;
  $: tokenAnalysis = analysis.tokenAnalysis;
  $: economics = analysis.economics;
  $: providers =
    [...new Set(analysis.modelCalls.map((call) => call.provider).filter(Boolean))].join(', ') ||
    'Unknown';
  // A failed attempt never reached a model; Claude Code names its placeholder "<synthetic>".
  $: models =
    [
      ...new Set(
        analysis.modelCalls
          .filter((call) => !call.usage.placeholder)
          .map((call) => call.model)
          .filter(Boolean),
      ),
    ].join(', ') || 'Unknown';
  $: coverage = tokenAnalysis.itemEstimateCoverage;
  $: estimates = estimateSummary(indexed);
  $: costCopy = describeCostBasis(economics.costBasis, session.source);
  // Framing-based reconciliation only applies to text-only routes; otherwise
  // summarise the approximate comparison the River draws instead.
  $: hasReconciliation = session.reconciliationComparableCalls > 0;
  $: inputSummary = hasReconciliation ? null : summarizeInputComparisons(indexed);
  $: costSummary = session.costSummary;
  $: cost = sessionCost(costSummary);
  $: costCoverage = sessionCostCoverage(costSummary);
  $: priceData = costSummary.priceData;
  $: costCoverageNote =
    session.reportedCostTotal === null ? null : recordedCoverageNote(session.reportedCostCoverage);
  $: usageCoverageNote =
    session.reportedPromptTokens === null
      ? null
      : recordedCoverageNote(session.reportedUsageCoverage);
</script>

<section class="summary" aria-label="Session summary">
  <div class="primary-metrics">
    <div><span>Model calls</span><b>{formatInteger(analysis.modelCalls.length)}</b></div>
    <div><span>Context items</span><b>{formatInteger(analysis.contextItems.length)}</b></div>
    <div>
      <span>Peak calculated context</span>
      <b
        >{session.peakCalculatedVisibleTokens === null
          ? 'Unknown'
          : formatWeight(session.peakCalculatedVisibleTokens, 'calculatedTokens')}</b
      >
    </div>
    <div class="cost-metric">
      {#if cost}
        <span
          >{cost.label}<InfoPopover id="session-cost-note" label="How the cost is worked out"
            >{cost.title}
            <span class="price-source"
              >Prices from models.dev {priceData.modelsDevCommit.slice(0, 7)} ({priceData.modelsDevCommittedAt.slice(
                0,
                10,
              )}){#if priceData.amendmentsImportedFrom}, with corrections from model-prices {priceData.amendmentsImportedFrom.slice(
                  0,
                  7,
                )}{/if}.</span
            ></InfoPopover
          ></span
        >
        <b>{cost.value}</b>
        <small class="metric-note">{cost.note}{costCoverage ? ` · ${costCoverage}` : ''}</small>
        {#if cost.split}<small class="metric-note">{cost.split}</small>{/if}
      {:else}
        <span>Cost</span>
        <b title="No call in this session has a known or estimated cost.">Unknown</b>
        {#if costCoverage}<small class="metric-note">{costCoverage}</small>{/if}
      {/if}
    </div>
  </div>

  <div class="session-status">
    <!-- One indicator for how far the token estimates can be trusted; its note explains why. -->
    <div class={`estimate-level ${estimates.level}`}>
      {estimates.label}<InfoPopover
        id="estimate-quality-note"
        label={`Why are estimates ${estimates.level}?`}
      >
        <p class="estimate-lead">{estimates.lead}</p>
        {#if estimates.reasons.length > 0}<ul class="estimate-reasons">
            {#each estimates.reasons as reason (reason)}<li>{reason}</li>{/each}
          </ul>{/if}
      </InfoPopover>
    </div>
    <details class="session-details" id="session-details">
      <summary class="disclosure" id="session-details-summary">Session details</summary>
      <div class="detail-columns">
        <section>
          <h3>Usage breakdown</h3>
          <dl>
            <div>
              <dt>
                Input tokens, all calls<InfoPopover
                  id="input-tokens-note"
                  label="About input tokens"
                  >Input tokens summed over every call. Each call sends the whole context again, so
                  most of these are cache reads.</InfoPopover
                >
              </dt>
              <dd>
                {formatMetric(session.reportedPromptTokens)}
                {#if usageCoverageNote}<small class="metric-note">{usageCoverageNote}</small>{/if}
              </dd>
            </div>
            <div>
              <dt>Output tokens, all calls</dt>
              <dd>{formatMetric(session.reportedCompletionTokens)}</dd>
            </div>
            <div>
              <dt>Reasoning tokens, all calls</dt>
              <dd>
                {#if session.reportedReasoningTokens === null}Not recorded<InfoPopover
                    id="reasoning-tokens-note"
                    label="Why reasoning tokens are not recorded"
                    >{harnessName(session.source)} does not record reasoning tokens separately for these
                    calls. Any reasoning is included in the output tokens.</InfoPopover
                  >{:else}{formatMetric(session.reportedReasoningTokens)}{/if}
              </dd>
            </div>
            <div>
              <dt>
                Cache-read share<InfoPopover
                  id="cache-read-share-note"
                  label="About cache-read share"
                  >The share of input tokens read from the provider's cache, over the {coverageLabel(
                    economics.cacheReadEligibleCalls,
                    analysis.modelCalls.length,
                  )} calls with complete usage.</InfoPopover
                >
              </dt>
              <dd>{formatPercent(economics.cacheReadRatio)}</dd>
            </div>
            <div>
              <dt>Compactions</dt>
              <dd>{formatInteger(analysis.compactions.length)}</dd>
            </div>
            {#if session.source !== 'claude-code'}
              <div>
                <dt>Billed cost (USD)</dt>
                <dd>
                  {costSummary.billed.calls > 0
                    ? formatCostSubtotal(costSummary.billed, true)
                    : 'None'}
                </dd>
              </div>
            {/if}
            <div>
              <dt>
                Recorded by {harnessName(session.source)} (USD)<InfoPopover
                  id="recorded-cost-note"
                  label="About the recorded cost">{costCopy.note}</InfoPopover
                >
              </dt>
              <dd>
                {#if session.reportedCostTotal === null}Not recorded{:else}{formatCost(
                    session.reportedCostTotal,
                  )}{/if}
                {#if costCoverageNote}<small class="metric-note">{costCoverageNote}</small>{/if}
              </dd>
            </div>
            {#if session.harnessSessionCost}
              <div>
                <dt>{harnessName(session.source)}'s own total (USD)</dt>
                <dd>
                  {formatSessionCost(session.harnessSessionCost.totalUsd)}
                  <small class="metric-note"
                    >{harnessSessionCostNote(session.harnessSessionCost, session.source)}</small
                  >
                </dd>
              </div>
            {/if}
          </dl>
        </section>
        <section>
          <h3>Session metadata</h3>
          <dl>
            <div>
              <dt>Provider</dt>
              <dd>{providers} · recorded by {harnessName(session.source)}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{models}</dd>
            </div>
            {#if session.title}
              <div>
                <dt>Title</dt>
                <dd>{session.title}</dd>
              </div>
            {/if}
            <div>
              <dt>Working directory</dt>
              <dd>{session.workingDirectory ?? 'Unknown'}</dd>
            </div>
          </dl>
        </section>
      </div>
      <!-- How the estimates and usage figures were worked out, for checking the estimator. -->
      <details class="diagnostics">
        <summary class="disclosure">Diagnostics</summary>
        <dl>
          <div>
            <dt>Reported usage completeness</dt>
            <dd>{session.reportedUsageCompleteness}</dd>
          </div>
          <div>
            <dt>Usage policy coverage (complete / partial / missing / unsupported)</dt>
            <dd>
              {formatInteger(economics.usageCompleteness.complete)} complete ·
              {formatInteger(economics.usageCompleteness.partial)} partial ·
              {formatInteger(economics.usageCompleteness.missing)} missing ·
              {formatInteger(economics.usageCompleteness.unsupported)} unsupported
            </dd>
          </div>
          {#if session.source !== 'claude-code'}
            <div>
              <dt>
                {costCopy.label} component coverage (complete / partial / missing / unsupported)
              </dt>
              <dd>
                {formatInteger(economics.costCompleteness.complete)} complete ·
                {formatInteger(economics.costCompleteness.partial)} partial ·
                {formatInteger(economics.costCompleteness.missing)} missing ·
                {formatInteger(economics.costCompleteness.unsupported)} unsupported
              </dd>
            </div>
          {/if}
          {#if isPiSource(session.source)}
            <div>
              <dt>Cache-write limits</dt>
              <dd>
                Anthropic writes are aggregated across TTLs. Copilot Responses uses separately
                recorded writes; older direct OpenAI adapter zeros do not establish measured zero
                writes. See each call's audited policy.
              </dd>
            </div>
          {/if}
          {#if tokenAnalysis.fallbackReason}
            <div>
              <dt>Fallback code</dt>
              <dd><code>{tokenAnalysis.fallbackReason}</code></dd>
            </div>
          {/if}
          <div>
            <dt>Estimate coverage (complete / partial / unavailable)</dt>
            <dd>
              {coverageLabel(coverage.completeItems, coverage.totalItems)} complete ·
              {formatInteger(coverage.partialItems)} partial ·
              {formatInteger(coverage.unavailableItems)} unavailable
            </dd>
          </div>
          <div>
            <dt>Calculated token-turns</dt>
            <dd>{formatMetric(session.calculatedTokenTurns)}</dd>
          </div>
          <div>
            <dt>Token-turn exposure coverage</dt>
            <dd>
              {coverageLabel(
                session.calculatedTokenTurnsCoverage.coveredCalls,
                session.calculatedTokenTurnsCoverage.totalCalls,
              )}
            </dd>
          </div>
          {#if hasReconciliation}
            <div>
              <dt>Reconciliation (complete / comparable calls)</dt>
              <dd>
                {formatInteger(session.reconciliationCompleteCalls)} /
                {formatInteger(session.reconciliationComparableCalls)}
              </dd>
            </div>
            <div>
              <dt>Residual median / maximum</dt>
              <dd>
                {formatPercent(session.medianAbsoluteResidualPercent)} /
                {formatPercent(session.maximumAbsoluteResidualPercent)}
              </dd>
            </div>
            <div>
              <dt>Negative residual calls</dt>
              <dd>{formatInteger(session.negativeResidualCalls)}</dd>
            </div>
          {:else if inputSummary}
            <div>
              <dt>Calls where the estimate exceeds reported input</dt>
              <dd>{formatInteger(inputSummary.estimateAboveReportedCalls)}</dd>
            </div>
          {/if}
          <div>
            <dt>Tokenizer methods</dt>
            <dd>
              {Object.entries(tokenAnalysis.tokenizerMethods)
                .map(([method, count]) => `${method}: ${formatInteger(count)}`)
                .join(' · ') || 'None'}
            </dd>
          </div>
        </dl>
        {#if tokenAnalysis.profiles.length > 0}
          <h4>Tokenization profiles</h4>
          <ul class="profiles">
            {#each tokenAnalysis.profiles as profile (profile.id)}
              <li>
                {profile.provider} / {profile.model} · {profile.method} · {profile.tokenizerFamily}
                (v{profile.version}){#if profile.api}
                  · {profile.api}{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </details>
    </details>
  </div>
</section>

<style>
  .summary {
    margin-top: 16px;
    min-width: 0;
  }
  .primary-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 9px;
  }
  .primary-metrics > div {
    min-width: 0;
    padding: 8px 12px 8px 0;
  }
  .primary-metrics span {
    display: block;
    color: var(--secondary);
    font-size: 12px;
  }
  .primary-metrics b {
    display: block;
    color: #eef2f8;
    margin-top: 2px;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .metric-note {
    display: block;
    color: var(--secondary);
    font-size: 12px;
    font-weight: normal;
  }
  /* Keep status and trigger inline; the full-width body clears both in either state. */
  .session-status {
    margin-top: 8px;
  }
  .session-status::after {
    content: '';
    display: block;
    clear: both;
  }
  .estimate-level {
    float: left;
    display: inline-flex;
    align-items: center;
    margin: 0 16px 0 0;
    color: var(--secondary);
    font-size: 13px;
  }
  .estimate-level.good {
    color: var(--accent);
  }
  .estimate-level.partial {
    color: var(--warning);
  }
  .estimate-level.rough {
    color: var(--error);
  }
  .price-source {
    display: block;
    margin-top: 6px;
    color: var(--secondary);
  }
  .estimate-lead {
    margin: 0;
  }
  .estimate-reasons {
    margin: 8px 0 0;
    padding-left: 18px;
  }
  .estimate-reasons li + li {
    margin-top: 4px;
  }
  .session-details {
    max-width: 100%;
    color: #b9c6da;
  }
  .session-details > summary {
    float: left;
  }
  .profiles {
    color: #aebbd0;
  }
  summary {
    cursor: pointer;
    width: fit-content;
  }
  summary:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 3px;
    border-radius: 2px;
  }
  .detail-columns {
    clear: both;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 14px 24px;
    margin-top: 10px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--separator);
    border-radius: 8px;
  }
  h3 {
    margin: 0 0 7px;
    color: #e2e8f3;
    font-size: 13px;
  }
  h4 {
    margin: 10px 0 4px;
    font-size: 12px;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 14px;
    margin: 0;
  }
  dt {
    color: var(--secondary);
    font-size: 12px;
  }
  dd {
    margin: 1px 0 0;
    overflow-wrap: anywhere;
    color: #d7e0ef;
  }
  .diagnostics {
    margin-top: 10px;
    padding: 0 12px;
  }
  .diagnostics > dl {
    margin-top: 8px;
  }
  .profiles {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  code {
    overflow-wrap: anywhere;
    color: #9fb2d5;
  }
  @media (max-width: 800px) {
    .primary-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .detail-columns {
      grid-template-columns: 1fr;
    }
  }
</style>
