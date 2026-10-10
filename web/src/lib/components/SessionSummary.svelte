<script lang="ts">
  import type { IndexedAnalysis } from '../types';
  import { estimateQuality } from '../estimate-quality';
  import { describeCostBasis, isPiSource } from '../cost-basis';
  import { reconstructionLimitLabels } from '../reconstruction';
  import { recordedCoverageNote } from '../recorded-usage';
  import { summarizeInputComparisons } from '../context-river/reported-input';
  import {
    chartUnitLabel,
    coverageLabel,
    formatCost,
    formatSessionCost,
    formatInteger,
    formatMetric,
    formatPercent,
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
  $: models =
    [...new Set(analysis.modelCalls.map((call) => call.model).filter(Boolean))].join(', ') ||
    'Unknown';
  $: coverage = tokenAnalysis.itemEstimateCoverage;
  $: quality = estimateQuality(analysis);
  $: costCopy = describeCostBasis(economics.costBasis);
  // Framing-based reconciliation only applies to text-only routes; otherwise
  // summarise the approximate comparison the River draws instead.
  $: hasReconciliation = session.reconciliationComparableCalls > 0;
  $: inputSummary = hasReconciliation ? null : summarizeInputComparisons(indexed);
  $: costCoverageNote =
    session.reportedCostTotal === null ? null : recordedCoverageNote(session.reportedCostCoverage);
  $: usageCoverageNote =
    session.reportedPromptTokens === null
      ? null
      : recordedCoverageNote(session.reportedUsageCoverage);
  $: usageMappingLabel = isPiSource(session.source)
    ? 'audited Pi provider/API mappings'
    : 'audited provider/API mappings';
</script>

<section class="summary" aria-label="Session summary">
  {#if analysis.reconstruction}
    <aside aria-label="Reconstruction coverage" class="reconstruction-coverage">
      <strong>Reconstructed conversation only.</strong> This is not a complete historical model
      request. System instructions, tool declarations, and request transformations may be missing.
      <details>
        <summary>Reconstruction limits</summary>
        <ul>
          {#each analysis.reconstruction.explanationCodes as code}<li>
              {reconstructionLimitLabels[code]}
            </li>{/each}
        </ul>
      </details>
    </aside>
  {/if}
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
    <div>
      <span>{costCopy.label}</span>
      <b
        title={`${costCopy.note}${costCoverageNote ? ' Calls without a recorded cost are not included.' : ''} Full precision is in Session details.`}
        >{session.reportedCostTotal !== null && session.reportedCostTotal >= 0.01
          ? '≈ '
          : ''}{formatSessionCost(session.reportedCostTotal)}</b
      >
      {#if costCoverageNote}<small class="metric-note">{costCoverageNote}</small>{/if}
    </div>
  </div>

  <div class="session-status">
    <p class="session-quality" class:warning={quality.tone !== 'info'}>{quality.label}</p>
    <details class="session-details" id="session-details">
      <summary id="session-details-summary">Session details</summary>
      <div class="detail-columns">
        <div class="detail-column">
          <section>
            <h3>Usage breakdown</h3>
            <dl>
              <div>
                <dt>Provider prompt</dt>
                <dd>
                  {formatMetric(session.reportedPromptTokens)}
                  {#if usageCoverageNote}<small class="metric-note">{usageCoverageNote}</small>{/if}
                </dd>
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
                <dt>{costCopy.totalLabel} (USD)</dt>
                <dd>
                  {formatCost(session.reportedCostTotal)}
                  {#if costCoverageNote}<small class="metric-note">{costCoverageNote}</small>{/if}
                </dd>
              </div>
              <div>
                <dt>Cost basis</dt>
                <dd>{costCopy.basisLabel}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>Reported usage and economics</h3>
            <p>
              Token ratios use {usageMappingLabel}. Some adapters normalize absent provider buckets
              to zero, so completeness describes persisted normalized usage, not proof the provider
              explicitly sent every zero. {costCopy.note}
            </p>
            <dl>
              <div>
                <dt>Cache-read share</dt>
                <dd>
                  {formatPercent(economics.cacheReadRatio)} ·
                  {coverageLabel(economics.cacheReadEligibleCalls, analysis.modelCalls.length)}
                  calls with complete supported usage
                </dd>
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
              <div>
                <dt>Cache-write limits</dt>
                <dd>
                  {#if isPiSource(session.source)}
                    Anthropic writes are aggregated across TTLs. Copilot Responses uses separately
                    recorded writes; older direct OpenAI adapter zeros do not establish measured
                    zero writes. See each call's audited policy.
                  {:else}
                    Cache-write detail follows the source normalization policy; see call details for
                    the policy and completeness status.
                  {/if}
                </dd>
              </div>
            </dl>
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

        <div class="detail-column">
          <section>
            <h3>Token estimates and diagnostics</h3>
            <dl>
              <div>
                <dt>Estimate quality</dt>
                <dd>{quality.message}</dd>
              </div>
              <div>
                <dt>Chart unit</dt>
                <dd>{chartUnitLabel(analysis.displayWeightUnit)}</dd>
              </div>
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
                  <dt>Reported input not reconstructed (approximate)</dt>
                  <dd>
                    {#if inputSummary.comparedCalls === 0}
                      Unavailable: no call has both complete reported input and numeric estimates
                    {:else}
                      Median {formatPercent(inputSummary.medianGapShare)} of reported input · up to
                      {formatMetric(inputSummary.maximumGap)} tokens ·
                      {formatInteger(inputSummary.comparedCalls)} calls compared
                    {/if}
                  </dd>
                </div>
                <div>
                  <dt>Calls where the estimate exceeds reported input</dt>
                  <dd>{formatInteger(inputSummary.estimateAboveReportedCalls)}</dd>
                </div>
              {/if}
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
        </div>
      </div>
    </details>
  </div>
</section>

<style>
  .summary {
    margin-top: 16px;
    min-width: 0;
  }
  .reconstruction-coverage {
    color: var(--warning);
    font-size: 12px;
    margin-bottom: 12px;
    overflow-wrap: anywhere;
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
  .session-quality {
    float: left;
    color: var(--secondary);
    margin: 0 16px 0 0;
    font-size: 12px;
  }
  .session-quality.warning {
    color: var(--warning);
  }
  .session-details {
    max-width: 100%;
    color: #b9c6da;
  }
  .session-details > summary {
    float: left;
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
  .detail-column {
    display: grid;
    align-content: start;
    gap: 14px;
    min-width: 0;
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
