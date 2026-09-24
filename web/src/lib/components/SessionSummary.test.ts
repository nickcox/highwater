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
    expect(screen.getByText('Reported cost')).toBeInTheDocument();
    expect(
      screen.getByText(/Some chart weights use best-effort token estimates/),
    ).toBeInTheDocument();

    const details = container.querySelector('details.session-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')).toHaveTextContent('Session details');
    expect(details).toHaveTextContent('Provider prompt');
    expect(details).toHaveTextContent('Compactions');
    expect(details).toHaveTextContent('Working directory');
    expect(details).toHaveTextContent('Residual median / max');
  });
});
