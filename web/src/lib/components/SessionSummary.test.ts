import { render, screen } from '@testing-library/svelte';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { describe, expect, it } from 'vitest';
import { testAnalysis } from '../context-river/test-data';
import SessionSummary from './SessionSummary.svelte';

describe('SessionSummary', () => {
  it('keeps four essential metrics visible and moves diagnostics into Session details', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const { container } = render(SessionSummary, { props: { indexed } });

    expect(container.querySelectorAll('.primary-metrics > div')).toHaveLength(4);
    expect(screen.getByText('Model calls')).toBeInTheDocument();
    expect(screen.getByText('Context items')).toBeInTheDocument();
    expect(screen.getByText('Peak calculated context')).toBeInTheDocument();
    expect(screen.getByText('Harness-recorded cost')).toBeInTheDocument();
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

  it('shows recorded cost as a subtotal with its call coverage', () => {
    const analysis = testAnalysis();
    analysis.session.reportedCostCoverage = {
      recordedCalls: 3,
      failedAttemptCalls: 1,
      missingCalls: 0,
    };
    const { container } = render(SessionSummary, {
      props: { indexed: indexTestAnalysis(analysis) },
    });
    const cost = container.querySelectorAll('.primary-metrics > div')[3];
    expect(cost).toHaveTextContent(/0\.06/);
    expect(cost).toHaveTextContent('3 of 4 calls · 1 failed attempt not recorded');
    expect(cost).not.toHaveTextContent('Unknown');
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
