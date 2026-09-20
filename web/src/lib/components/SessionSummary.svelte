<script lang="ts">
  import type { IndexedAnalysis } from '../types';
  import { chartUnitLabel, coverageLabel, formatCost, formatMetric, formatPercent } from '../context-river/format';
  export let indexed: IndexedAnalysis;

  $: providers = [...new Set(indexed.analysis.modelCalls.map((call) => call.provider).filter(Boolean))].join(', ') || 'Unknown';
  $: models = [...new Set(indexed.analysis.modelCalls.map((call) => call.model).filter(Boolean))].join(', ') || 'Unknown';
  $: coverage = indexed.analysis.tokenAnalysis.itemEstimateCoverage;
</script>

<section class="summary" aria-label="Session summary">
  <div><span>Model calls</span><b>{indexed.analysis.modelCalls.length}</b></div>
  <div><span>Context items</span><b>{indexed.analysis.contextItems.length}</b></div>
  <div><span>Compactions</span><b>{indexed.analysis.compactions.length}</b></div>
  <div><span>Provider prompt</span><b>{formatMetric(indexed.analysis.session.reportedPromptTokens)}</b></div>
  <div><span>Provider output</span><b>{formatMetric(indexed.analysis.session.reportedCompletionTokens)}</b></div>
  <div><span>Provider reasoning</span><b>{formatMetric(indexed.analysis.session.reportedReasoningTokens)}</b></div>
  <div><span>Reported cost total</span><b>{formatCost(indexed.analysis.session.reportedCostTotal)}</b></div>
  <div><span>Provider usage</span><b>{indexed.analysis.session.reportedUsageCompleteness}</b></div>
  <div><span>Calculated token-turns</span><b>{formatMetric(indexed.analysis.session.calculatedTokenTurns)}</b></div>
  <div><span>Peak calculated context</span><b>{formatMetric(indexed.analysis.session.peakCalculatedVisibleTokens)}</b></div>
  <div><span>Reconciliation</span><b>{indexed.analysis.session.reconciliationCompleteCalls} / {indexed.analysis.session.reconciliationComparableCalls}</b></div>
  <div><span>Estimate coverage</span><b>{coverageLabel(coverage.completeItems, coverage.totalItems)}</b></div>
  <div><span>Residual median / max</span><b>{formatPercent(indexed.analysis.session.medianAbsoluteResidualPercent)} / {formatPercent(indexed.analysis.session.maximumAbsoluteResidualPercent)}</b></div>
  <div><span>Tokenizer methods</span><b>{Object.entries(indexed.analysis.tokenAnalysis.tokenizerMethods).map(([method, count]) => `${method}: ${count}`).join(' · ') || 'None'}</b></div>
  <div class="wide"><span>Provider / model</span><b>{providers} · {models}</b></div>
  <div class="wide"><span>Chart unit</span><b>{chartUnitLabel(indexed.analysis.displayWeightUnit)}{indexed.analysis.tokenAnalysis.fallbackReason ? ` · ${indexed.analysis.tokenAnalysis.fallbackReason}` : ''}</b></div>
  <div class="wide"><span>Working directory</span><b>{indexed.analysis.session.workingDirectory ?? 'Unknown'}</b></div>
</section>

<style>
  .summary { display: grid; grid-template-columns: repeat(7, minmax(110px, 1fr)); gap: 9px; margin-top: 16px; }
  .summary div { background: #11182c; border: 1px solid #26324f; border-radius: 10px; padding: 10px 12px; min-width: 0; }
  span { display: block; color: #8f9cb2; font-size: 11px; }
  b { display: block; color: #eef2f8; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wide { grid-column: span 2; }
  @media(max-width: 1050px) { .summary { grid-template-columns: repeat(3, 1fr); } }
  @media(max-width: 600px) { .summary { grid-template-columns: repeat(2, 1fr); } .wide { grid-column: span 2; } }
</style>
