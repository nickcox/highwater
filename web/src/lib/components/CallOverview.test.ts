import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { testAnalysis } from '../context-river/test-data';
import { displayItemLabel } from '../item-label';
import CallOverview from './CallOverview.svelte';

afterEach(cleanup);

describe('CallOverview', () => {
  it('names the latest call while following and the call number otherwise', async () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const calls = indexed.analysis.modelCalls;
    const call = calls[calls.length - 1];
    const view = render(CallOverview, { props: { indexed, call, following: true } });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Latest call');
    await view.rerender({ indexed, call, following: false });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(`Call ${call.index}`);
  });

  it('shows the input change, cost, context changes and largest items', async () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const [previous, call] = indexed.analysis.modelCalls;
    previous.reportedPromptTokens = 1000;
    call.reportedPromptTokens = 1500;
    const onSelectItem = vi.fn();
    const onShowComposition = vi.fn();
    const onViewDetails = vi.fn();
    render(CallOverview, {
      props: { indexed, call, onSelectItem, onShowComposition, onViewDetails },
    });
    expect(screen.getByText('Input').nextElementSibling).toHaveTextContent('1.5K');
    expect(screen.getByTitle(`Change since call ${previous.index}`)).toHaveTextContent('+500');
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(document.querySelector('.size')?.textContent).toMatch(/^\S+ · \S+%$|^\S+$/);
    expect(
      screen.getByRole('heading', {
        name: /^Context changes · \d+ added( \(≈ .+\))? · \d+ dropped/,
      }),
    ).toBeInTheDocument();
    const largest = screen.getByRole('heading', { name: 'Largest items in context' })
      .nextElementSibling as HTMLElement;
    const rows = within(largest).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    await fireEvent.click(within(rows[0]).getByRole('button'));
    expect(onSelectItem).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Show all in Composition' }));
    expect(onShowComposition).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('lists at most five added items and counts the rest', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[0];
    const ids = Array.from({ length: 7 }, (_, n) => `synthetic-item-${n}`);
    call.addedItemIds = ids;
    call.droppedItemIds = [];
    render(CallOverview, { props: { indexed, call } });
    for (const id of ids.slice(0, 5))
      expect(
        screen.getByRole('button', {
          name: `Added ${displayItemLabel(indexed.itemById.get(id), id)}`,
        }),
      ).toBeInTheDocument();
    expect(screen.getByText(`${ids.length - 5} more added`)).toBeInTheDocument();
  });

  it('explains an empty view', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    render(CallOverview, { props: { indexed, call: null } });
    expect(screen.getByText('Select a call in the chart to see it here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
  });
});

describe('CallOverview context changes', () => {
  it('shows estimated tokens, a total and the largest added items first', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[0];
    indexed.itemById.get('a')!.tokenEstimates[0].tokens = 25;
    indexed.itemById.get('retained')!.tokenEstimates[0].tokens = 75;
    call.addedItemIds = ['a', 'retained'];
    call.droppedItemIds = [];
    render(CallOverview, { props: { indexed, call } });
    expect(
      screen.getByRole('heading', { name: 'Context changes · 2 added (≈ 100) · 0 dropped' }),
    ).toBeInTheDocument();
    const rows = within(
      screen.getByRole('heading', { name: /^Context changes/ }).nextElementSibling as HTMLElement,
    ).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.size')?.textContent)).toEqual(['75', '25']);
  });
});
