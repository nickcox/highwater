import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from '../context-river/test-data';
import { sessionScenario } from '../testing/session-scenarios';
import ItemDetails from './ItemDetails.svelte';

afterEach(cleanup);

describe('ItemDetails presence feedback', () => {
  it('keeps a selected item absent at the pinned call and offers explicit reveal', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const onRevealInRiver = vi.fn();
    render(ItemDetails, {
      props: {
        item: indexed.itemById.get('gap')!,
        indexed,
        callIndex: 2,
        pinnedCallIndex: 2,
        onRevealInRiver,
      },
    });

    expect(screen.getByText(/not present at pinned call 2/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Reveal in River' }));
    expect(onRevealInRiver).toHaveBeenCalledWith('gap');
  });

  it('explains that a presence-less terminal item has no River location', () => {
    const indexed = indexAnalysis(sessionScenario('terminalSummaryOnly'));
    render(ItemDetails, {
      props: { item: indexed.analysis.contextItems[0], indexed },
    });

    expect(
      screen.getByText(/has no model-call presence.*no location to reveal/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal in River' })).toBeNull();
  });
});
