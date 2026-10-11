import { render, screen } from '@testing-library/svelte';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { describe, expect, it } from 'vitest';
import { costAssessmentOf, costSummaryFor, testAnalysis } from '../context-river/test-data';
import SessionSummary from './SessionSummary.svelte';

describe('SessionSummary', () => {
  it('keeps four essential metrics visible and moves diagnostics into Session details', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const { container } = render(SessionSummary, { props: { indexed } });

    expect(container.querySelectorAll('.primary-metrics > div')).toHaveLength(4);
    expect(screen.getByText('Model calls')).toBeInTheDocument();
    expect(screen.getByText('Context items')).toBeInTheDocument();
    expect(screen.getByText('Peak calculated context')).toBeInTheDocument();
    expect(container.querySelectorAll('.primary-metrics > div')[3]).toHaveTextContent(/^Cost/);
    expect(screen.queryByTestId('estimate-caveat')).not.toBeInTheDocument();

    const details = container.querySelector('details.session-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')).toHaveTextContent('Session details');
    expect(details).toHaveTextContent('Provider prompt');
    expect(details).toHaveTextContent('Compactions');
    expect(details).toHaveTextContent('Working directory');
    expect(details).toHaveTextContent('Reported input not reconstructed (approximate)');
    expect(details).not.toHaveTextContent('Residual median / maximum');
    expect(details).toHaveTextContent('Some item weights use best-effort local token estimates.');
    expect(details).toHaveTextContent('best-effort-tokenization');

    const columns = container.querySelector('.detail-columns')!;
    const groups = [...columns.querySelectorAll(':scope > .detail-column')];
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('Usage breakdown');
    expect(groups[0]).toHaveTextContent('Reported usage and economics');
    expect(groups[0]).toHaveTextContent('not provider-billed charges');
    expect(groups[0]).toHaveTextContent('Session metadata');
    expect(groups[1]).toHaveTextContent('Token estimates and diagnostics');
  });

  it('shows billed cost with its call count and the calls without a price', () => {
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(testAnalysis()) },
    });
    const cost = container.querySelectorAll('.primary-metrics > div')[3];
    expect(cost).toHaveTextContent(/Cost\s*≈ \D*0\.06\s*3 calls/);
    expect(cost).toHaveTextContent('1 call without a price');
    expect(cost).not.toHaveTextContent('API-equivalent');
  });

  it('adds subscription calls to the cost and splits a mixed session underneath', () => {
    const analysis = testAnalysis();
    analysis.modelCalls[0].costAssessment = {
      ...costAssessmentOf('apiEquivalent', 1.5),
      amountHigh: 1.75,
    };
    analysis.modelCalls[1].costAssessment = {
      ...costAssessmentOf('unknown', null),
      classificationRule: 'failedAttempt',
    };
    analysis.session.costSummary = costSummaryFor(analysis.modelCalls);
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(analysis) },
    });
    const cost = container.querySelectorAll('.primary-metrics > div')[3];
    expect(cost).toHaveTextContent(/Cost\s*≈ \D*1\.55–\D*1\.80\s*3 calls/);
    expect(cost).toHaveTextContent(
      /≈ \D*0\.05 billed per token · ≈ \D*1\.50–\D*1\.75 covered by a subscription/,
    );
    expect(cost).toHaveTextContent('1 failed attempt not counted');
    const details = container.querySelector('details.session-details')!;
    expect(details).toHaveTextContent('API-equivalent cost of subscription calls (USD)');
    expect(details).toHaveTextContent('Price data');
  });

  it('shows an unknown cost when no call has one', () => {
    const analysis = testAnalysis();
    for (const call of analysis.modelCalls) call.costAssessment = costAssessmentOf('unknown', null);
    analysis.session.costSummary = costSummaryFor(analysis.modelCalls);
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(analysis) },
    });
    const cost = container.querySelectorAll('.primary-metrics > div')[3];
    expect(cost).toHaveTextContent(/Cost\s*Unknown\s*4 calls without a price/);
  });

  it("shows Claude Code's own total only in Session details, with what it covers", () => {
    const analysis = testAnalysis();
    analysis.session.source = 'claude-code';
    analysis.reconstruction = {
      status: 'partial',
      explanationCodes: ['missingHistoricalSystemPrompt', 'unrecordedHarnessCalls'],
    };
    analysis.session.harnessSessionCost = { totalUsd: 2.28, sinceMs: Date.UTC(2026, 9, 10, 6, 3) };
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(analysis) },
    });
    expect(container.querySelector('.primary-metrics')).not.toHaveTextContent('own total');
    const row = [...container.querySelectorAll('.session-details dl > div')].find((element) =>
      element.textContent?.includes("Claude Code's own total"),
    );
    expect(row).toHaveTextContent(/2\.28/);
    expect(row).toHaveTextContent(
      /Since .* · includes subagents and Claude Code's own calls, which are not in this transcript/,
    );
    expect(container).toHaveTextContent('None: Claude Code records no cost');
  });

  it('has no own-total row when the harness recorded none', () => {
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(testAnalysis()) },
    });
    expect(container).not.toHaveTextContent('own total');
  });

  it('shows framing-based reconciliation only when some call supports it', () => {
    const analysis = testAnalysis();
    analysis.session.reconciliationComparableCalls = 2;
    analysis.session.reconciliationCompleteCalls = 1;
    analysis.session.medianAbsoluteResidualPercent = 0.02;
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(analysis) },
    });
    const details = container.querySelector('details.session-details')!;
    expect(details).toHaveTextContent('Residual median / maximum');
    expect(details).toHaveTextContent('1 / 2');
    expect(details).not.toHaveTextContent('Reported input not reconstructed');
  });

  it('uses the declared cost basis for non-Pi session copy', () => {
    const analysis = testAnalysis();
    analysis.session.source = 'other-source';
    analysis.economics.costBasis = 'providerReported';
    const indexed = indexTestAnalysis(analysis);
    const { container } = render(SessionSummary, { props: { indexed } });

    expect(container).toHaveTextContent('Provider-reported cost');
    expect(container).toHaveTextContent('Provider-reported');
    expect(container).not.toHaveTextContent('Harness-recorded cost');
    expect(container).not.toHaveTextContent('configured Pi model rates');
  });
});
