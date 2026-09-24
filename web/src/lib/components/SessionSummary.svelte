<script lang="ts">
  import type { IndexedAnalysis } from '../types';
  import {
    chartUnitLabel,
    coverageLabel,
    formatCost,
    formatInteger,
    formatMetric,
    formatPercent,
    formatWeight,
  } from '../context-river/format';
  export let indexed: IndexedAnalysis;

  $: analysis = indexed.analysis;
  $: session = analysis.session;
  $: tokenAnalysis = analysis.tokenAnalysis;
  $: providers =
    [...new Set(analysis.modelCalls.map((call) => call.provider).filter(Boolean))].join(', ') ||
    'Unknown';
  $: models =
    [...new Set(analysis.modelCalls.map((call) => call.model).filter(Boolean))].join(', ') ||
    'Unknown';
  $: coverage = tokenAnalysis.itemEstimateCoverage;
  $: incompleteItemCount = coverage.partialItems + coverage.unavailableItems;
  $: estimateCaveat =
    analysis.displayWeightUnit === 'unavailable'
      ? 'Token geometry is unavailable; the chart uses structural placeholders.'
      : tokenAnalysis.fallbackReason === 'best-effort-tokenization'
        ? 'Some chart weights use best-effort token estimates; provider usage is separate.'
        : tokenAnalysis.fallbackReason === 'tokenizationDisabled'
          ? 'Token analysis is disabled; the chart does not show token-weighted geometry.'
          : tokenAnalysis.fallbackReason
            ? 'Some chart weights use a fallback method; see Session details.'
            : incompleteItemCount > 0
              ? 'Token estimates have partial coverage; provider usage is separate.'
              : 'Local calculated context can differ from provider-reported prompt usage.';
  $: fallbackReasonText =
    tokenAnalysis.fallbackReason === 'best-effort-tokenization'
      ? 'Some weights are best-effort token estimates.'
      : tokenAnalysis.fallbackReason === 'tokenizationDisabled'
        ? 'Token analysis is disabled.'
        : (tokenAnalysis.fallbackReason ?? 'None');
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
    <div><span>Reported cost</span><b>{formatCost(session.reportedCostTotal)}</b></div>
  </div>

  <p class="estimate-caveat" data-testid="estimate-caveat">
    <b>Token estimate caveat</b>
    {estimateCaveat}
  </p>

  <details class="session-details">
    <summary>Session details</summary>
    <div class="detail-sections">
      <section>
        <h3>Usage breakdown</h3>
        <dl>
          <div>
            <dt>Provider prompt</dt>
            <dd>{formatMetric(session.reportedPromptTokens)}</dd>
          </div>
          <div>
            <dt>Provider output</dt>
            <dd>{formatMetric(session.reportedCompletionTokens)}</dd>
          </div>
          <div>
            <dt>Provider reasoning</dt>
            <dd>{formatMetric(session.reportedReasoningTokens)}</dd>
          </div>
          <div>
            <dt>Reported usage completeness</dt>
            <dd>{session.reportedUsageCompleteness}</dd>
          </div>
          <div>
            <dt>Compactions</dt>
            <dd>{formatInteger(analysis.compactions.length)}</dd>
          </div>
          <div>
            <dt>Reported cost (USD)</dt>
            <dd>{formatCost(session.reportedCostTotal)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3>Token estimates and diagnostics</h3>
        <dl>
          <div>
            <dt>Chart unit</dt>
            <dd>{chartUnitLabel(analysis.displayWeightUnit)}</dd>
          </div>
          <div>
            <dt>Fallback</dt>
            <dd>{fallbackReasonText}</dd>
          </div>
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
            <dt>Token-turn call coverage</dt>
            <dd>
              {coverageLabel(
                session.calculatedTokenTurnsCoverage.coveredCalls,
                session.calculatedTokenTurnsCoverage.totalCalls,
              )}
            </dd>
          </div>
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
          <div>
            <dt>Calls missing provider usage</dt>
            <dd>{formatInteger(session.missingProviderUsageCalls)}</dd>
          </div>
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
      </section>

      <section>
        <h3>Session metadata</h3>
        <dl>
          <div>
            <dt>Provider</dt>
            <dd>{providers}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{models}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{session.source}</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{session.title ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt>Working directory</dt>
            <dd>{session.workingDirectory ?? 'Unknown'}</dd>
          </div>
        </dl>
      </section>
    </div>
  </details>
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
    padding: 10px 12px;
    background: #11182c;
    border: 1px solid #26324f;
    border-radius: 10px;
  }
  .primary-metrics span {
    display: block;
    color: #8f9cb2;
    font-size: 11px;
  }
  .primary-metrics b {
    display: block;
    color: #eef2f8;
    margin-top: 2px;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .estimate-caveat {
    margin: 9px 0 0;
    padding: 8px 10px;
    color: #b9c8df;
    background: #11182c;
    border-left: 3px solid #7895bd;
    font-size: 12px;
  }
  .estimate-caveat b {
    margin-right: 4px;
    color: #e2e8f3;
  }
  .session-details {
    margin-top: 8px;
    color: #b9c6da;
  }
  .session-details > summary,
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
  .detail-sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 24px;
    margin-top: 10px;
    padding: 12px;
    background: #0d1425;
    border: 1px solid #25314a;
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
    color: #8996ad;
    font-size: 11px;
  }
  dd {
    margin: 1px 0 0;
    overflow-wrap: anywhere;
    color: #d7e0ef;
  }
  .profiles {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  @media (max-width: 800px) {
    .primary-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .detail-sections {
      grid-template-columns: 1fr;
    }
  }
</style>
