import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from '../context-river/test-data';
import CallDetails from './CallDetails.svelte';

function renderCall(addedItemIds: string[], droppedItemIds: string[]) {
  const indexed = indexAnalysis(testAnalysis());
  const call = indexed.analysis.modelCalls[0];
  call.addedItemIds = addedItemIds;
  call.droppedItemIds = droppedItemIds;
  call.transitionItemCounts.added = addedItemIds.length;
  call.transitionItemCounts.dropped = droppedItemIds.length;
  return render(CallDetails, { props: { call, indexed, pinned: true } });
}

describe('CallDetails change lists', () => {
  it('omits the dropped-items disclosure when nothing was dropped', () => {
    const { container } = renderCall(['a'], []);

    expect(screen.getByText('Added items (1)')).toBeInTheDocument();
    expect(screen.queryByText('Dropped items (0)')).not.toBeInTheDocument();
    expect(container.querySelector('.change-lists')).toHaveClass('single');
  });

  it('omits the added-items disclosure when nothing was added', () => {
    const { container } = renderCall([], ['gap']);

    expect(screen.queryByText('Added items (0)')).not.toBeInTheDocument();
    expect(screen.getByText('Dropped items (1)')).toBeInTheDocument();
    expect(container.querySelector('.change-lists')).toHaveClass('single');
  });

  it('omits the change-list area when both sets are empty', () => {
    const { container } = renderCall([], []);

    expect(screen.queryByText('Added items (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Dropped items (0)')).not.toBeInTheDocument();
    expect(container.querySelector('.change-lists')).not.toBeInTheDocument();
  });
});
