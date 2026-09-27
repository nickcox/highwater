import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from '../context-river/test-data';
import SessionSummary from './SessionSummary.svelte';

describe('SessionSummary', () => {
  it('keeps four essential metrics visible and moves diagnostics into Session details', () => {
    const indexed = indexAnalysis(testAnalysis());
    const { container } = render(SessionSummary, { props: { indexed } });

    expect(container.querySelectorAll('.primary-metrics > div')).toHaveLength(4);
    expect(screen.getByText('Model calls')).toBeInTheDocument();
    expect(screen.getByText('Context items')).toBeInTheDocument();
    expect(screen.getByText('Peak calculated context')).toBeInTheDocument();
    expect(screen.getByText('Pi-calculated cost')).toBeInTheDocument();
    expect(screen.queryByTestId('estimate-caveat')).not.toBeInTheDocument();

    const details = container.querySelector('details.session-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')).toHaveTextContent('Session details');
    expect(details).toHaveTextContent('Provider prompt');
    expect(details).toHaveTextContent('Compactions');
    expect(details).toHaveTextContent('Working directory');
    expect(details).toHaveTextContent('Residual median / maximum');
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

  it('uses the declared cost basis for non-Pi session copy', () => {
    const analysis = testAnalysis();
    analysis.session.source = 'other-source';
    analysis.economics.costBasis = 'providerReported';
    const indexed = indexAnalysis(analysis);
    const { container } = render(SessionSummary, { props: { indexed } });

    expect(container).toHaveTextContent('Provider-reported cost');
    expect(container).toHaveTextContent('Provider-reported');
    expect(container).not.toHaveTextContent('Pi-calculated');
    expect(container).not.toHaveTextContent('configured Pi model rates');
  });
});
