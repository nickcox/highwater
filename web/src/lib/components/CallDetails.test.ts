import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from '../context-river/test-data';
import CallDetails from './CallDetails.svelte';

afterEach(cleanup);

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
  it('labels reported usage Input and Output without changing the underlying counts', () => {
    const indexed = indexAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[0];
    call.reportedPromptTokens = 12345;
    call.reportedCompletionTokens = 678;
    const { container } = render(CallDetails, { props: { call, indexed, pinned: true } });
    const metrics = container.querySelector('.essential-metrics')!;
    expect([...metrics.querySelectorAll('dt')].map((node) => node.textContent)).toContain('Input');
    expect([...metrics.querySelectorAll('dt')].map((node) => node.textContent)).not.toContain(
      'Prompt',
    );
    expect(screen.getByText('Input').nextElementSibling).toHaveTextContent('12.3K');
    expect(screen.getByText('Output').nextElementSibling).toHaveTextContent('678');
  });
  it('renders tool metadata as noninteractive text with an explicit failure label', () => {
    const indexed = indexAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[0];
    call.toolCallsAfter[0].failed = true;
    const { container } = render(CallDetails, { props: { call, indexed, pinned: true } });
    const chip = container.querySelector('.tool-chip');
    expect(chip?.tagName).toBe('SPAN');
    expect(chip).toHaveTextContent('bash');
    expect(chip).toHaveTextContent('failed');
    expect(chip).not.toHaveAttribute('tabindex');
    expect(chip).not.toHaveAttribute('role');
    expect(container.querySelector('.tool-chip button')).toBeNull();
  });

  it('uses plain headings inside a single Context changes disclosure', () => {
    const { container } = renderCall(['a'], ['gap']);
    const changes = container.querySelector('.change-lists')!;
    expect(changes.closest('details')).not.toBeNull();
    expect(changes.querySelectorAll('details, summary')).toHaveLength(0);
    expect(changes.querySelectorAll('h4')).toHaveLength(2);
    expect(changes.querySelectorAll('ul[role="list"]')).toHaveLength(2);
    expect(changes.querySelector('h4')).toHaveTextContent('Added items (1)');
    expect(changes.querySelectorAll('h4')[1]).toHaveTextContent('Dropped items (1)');
  });

  it('preserves context order even when a later item has a larger estimate', () => {
    const { container } = renderCall(['retained', 'a'], []);
    expect(
      [...container.querySelectorAll('.change-lists button')].map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Select added item retained tail', 'Select added item bash: npm test']);
  });

  it('uses the preceding call profile for dropped groups, including nonconsecutive call indices', () => {
    const indexed = indexAnalysis(testAnalysis());
    const previous = indexed.analysis.modelCalls[1];
    previous.index = 17;
    previous.tokenizationProfileId = 'previous-profile';
    previous.tokenAnalysis.calculatedVisibleTokens = 100;
    const call = indexed.analysis.modelCalls[2];
    call.index = 31;
    indexed.itemById.get('a')!.tokenEstimates.push({
      ...indexed.itemById.get('a')!.tokenEstimates[0],
      profileId: 'previous-profile',
      tokens: 40,
    });
    render(CallDetails, { props: { call, indexed, pinned: true } });
    expect(
      screen.getByRole('button', { name: 'Select dropped item bash: npm test' }),
    ).toHaveAccessibleDescription(
      'Estimated 40 tokens; 100% of estimated dropped tokens (call 17)',
    );
    expect(
      screen.getByText('Share of estimated dropped tokens · previous call 17'),
    ).toBeInTheDocument();
  });

  it('omits the dropped-items group when nothing was dropped', () => {
    const { container } = renderCall(['a'], []);

    expect(screen.getByText('Added items (1)')).toBeInTheDocument();
    expect(screen.queryByText('Dropped items (0)')).not.toBeInTheDocument();
    expect(container.querySelector('.change-lists')).toHaveClass('single');
  });

  it('omits the added-items group when nothing was added', () => {
    const { container } = renderCall([], ['gap']);

    expect(screen.queryByText('Added items (0)')).not.toBeInTheDocument();
    expect(screen.getByText('Dropped items (1)')).toBeInTheDocument();
    expect(container.querySelector('.change-lists')).toHaveClass('single');
  });

  it('does not present Pi-dropped cache writes as a measured zero', () => {
    const analysis = testAnalysis();
    const call = analysis.modelCalls[0];
    call.provider = 'openai';
    call.api = 'openai-responses';
    call.usage = { ...call.usage, input: 5, cacheRead: 5, cacheWrite: 0 };
    call.economics = {
      policyId: 'openai-responses-cache-read-v1',
      usageCompleteness: 'complete',
      costCompleteness: 'partial',
      cacheWriteStatus: 'notRetainedByPi',
      promptTokens: 10,
      cacheReadRatio: 0.5,
      cacheWriteRatio: null,
      freshRatio: null,
      piPromptCost: null,
      cacheRatioDiscontinuity: null,
      explanationCodes: ['cacheWriteNotRetainedByPi'],
    };
    analysis.session.source = 'pi';
    analysis.economics.supportedPolicyIds = ['openai-responses-cache-read-v1'];
    analysis.economics.usageCompleteness = {
      complete: 1,
      partial: 0,
      missing: 0,
      unsupported: 3,
    };
    analysis.economics.costCompleteness = {
      complete: 0,
      partial: 1,
      missing: 0,
      unsupported: 3,
    };
    analysis.economics.cacheReadEligibleCalls = 1;
    analysis.economics.cacheReadPromptTokens = 10;
    analysis.economics.cacheReadTokens = 5;
    analysis.economics.cacheReadRatio = 0.5;
    const indexed = indexAnalysis(analysis);
    const { container } = render(CallDetails, {
      props: { call: indexed.analysis.modelCalls[0], indexed, pinned: true },
    });

    expect(container).toHaveTextContent('Non-cache-read input (may include writes)');
    expect(container).toHaveTextContent('Not retained by Pi');
    expect(container).toHaveTextContent('Unavailable; writes may be included in non-read input');
    expect(container).not.toHaveTextContent('Cache write 0');
  });

  it('explains cache-share changes and links to the prior call', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const call = {
      ...indexed.analysis.modelCalls[1],
      economics: {
        ...indexed.analysis.modelCalls[1].economics,
        cacheRatioDiscontinuity: {
          previousCallIndex: 1,
          direction: 'drop' as const,
          previousRatio: 0.5,
          currentRatio: 0.25,
          delta: 0.25,
          magnitude: 'notable' as const,
          method: 'adjacent-cache-read-share-v1' as const,
          previousPromptTokens: 1000,
          currentPromptTokens: 1000,
          compactionBefore: null,
        },
      },
    };
    const onPinCall = vi.fn<(index: number) => void>();
    const { container } = render(CallDetails, {
      props: { call, indexed, pinned: true, onPinCall },
    });

    expect(container).toHaveTextContent(
      'Cache-read share dropped from 50.0% on call 1 to 25.0% on call 2',
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect previous call 1' }));
    expect(onPinCall).toHaveBeenCalledWith(1);
  });

  it('omits the change-list area when both sets are empty', () => {
    const { container } = renderCall([], []);

    expect(screen.queryByText('Added items (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Dropped items (0)')).not.toBeInTheDocument();
    expect(container.querySelector('.change-lists')).not.toBeInTheDocument();
  });
});
