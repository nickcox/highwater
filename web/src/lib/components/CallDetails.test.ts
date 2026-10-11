import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { costAssessmentOf, testAnalysis } from '../context-river/test-data';
import type { ModelCall } from '../types';
import CallDetails from './CallDetails.svelte';

afterEach(cleanup);

function renderCall(addedItemIds: string[], droppedItemIds: string[]) {
  const indexed = indexTestAnalysis(testAnalysis());
  const call = indexed.analysis.modelCalls[0];
  call.addedItemIds = addedItemIds;
  call.droppedItemIds = droppedItemIds;
  call.transitionItemCounts.added = addedItemIds.length;
  call.transitionItemCounts.dropped = droppedItemIds.length;
  return render(CallDetails, { props: { call, indexed, pinned: true } });
}

describe('CallDetails transition metrics', () => {
  it('marks token-based metrics that include partial estimates', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[1];
    call.tokenAnalysis.retainedTokens = 40;
    call.tokenAnalysis.churn = 0.25;
    call.tokenAnalysis.metricsIncludePartialEstimates = true;
    render(CallDetails, { props: { call, indexed, pinned: true } });
    expect(screen.getByText('Retained tokens').nextElementSibling).toHaveTextContent('≈ 40');
    expect(screen.getByText('Calculated churn').nextElementSibling).toHaveTextContent('≈ 25%');
    expect(screen.getByText('Estimate basis').nextElementSibling).toHaveTextContent(
      'partial token estimates',
    );
  });

  it('leaves complete-estimate metrics and unknown values unmarked', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[1];
    call.tokenAnalysis.retainedTokens = 40;
    call.tokenAnalysis.churn = null;
    render(CallDetails, { props: { call, indexed, pinned: true } });
    expect(screen.getByText('Retained tokens').nextElementSibling).toHaveTextContent(/^40$/);
    expect(screen.getByText('Calculated churn').nextElementSibling).toHaveTextContent('Unknown');
    expect(screen.queryByText('Estimate basis')).toBeNull();
  });
});

describe('CallDetails input comparison', () => {
  it('shows an approximate comparison instead of empty reconciliation rows', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[1];
    call.reportedUsageCompleteness = 'complete';
    call.reportedPromptTokens = call.tokenAnalysis.calculatedVisibleTokens! + 50;
    render(CallDetails, { props: { call, indexed, pinned: true } });
    expect(
      screen.getByText('Reported − reconstructed (approximate)').nextElementSibling,
    ).toHaveTextContent('50 tokens');
    expect(screen.queryByText('Residual')).toBeNull();
    expect(screen.queryByText('Calculated request')).toBeNull();
    expect(screen.queryByText('Reconciliation status')).toBeNull();
  });
});

describe('CallDetails change lists', () => {
  it('shows recorded output independently of normalized completion totals', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[0];
    call.reportedPromptTokens = 12345;
    call.reportedCompletionTokens = 999;
    call.usage.recordedOutput = 678;
    call.usage.reasoning = 50;
    const { container } = render(CallDetails, { props: { call, indexed, pinned: true } });
    const metrics = container.querySelector('.essential-metrics')!;
    expect([...metrics.querySelectorAll('dt')].map((node) => node.textContent)).toContain('Input');
    expect([...metrics.querySelectorAll('dt')].map((node) => node.textContent)).not.toContain(
      'Prompt',
    );
    expect(screen.getByText('Input').nextElementSibling).toHaveTextContent('12.3K');
    expect(screen.getByText('Recorded output').nextElementSibling).toHaveTextContent('678');
    expect(screen.getByText('Recorded reasoning').nextElementSibling).toHaveTextContent('50');
    expect(metrics).not.toHaveTextContent('999');
    expect(
      screen.getByText('Completion total (including reasoning)').nextElementSibling,
    ).toHaveTextContent('999');
  });

  it.each(['pi', 'opencode', 'future-harness'])(
    'renders the same recorded counters for %s without a harness-specific display',
    (source) => {
      const indexed = indexTestAnalysis(testAnalysis());
      indexed.analysis.session.source = source;
      const call = indexed.analysis.modelCalls[0];
      call.reportedCompletionTokens = null;
      call.usage.output = null;
      call.usage.recordedOutput = 20;
      call.usage.reasoning = 10;
      call.usage.outputReasoningRelationship = 'unknown';
      const { container } = render(CallDetails, { props: { call, indexed, pinned: true } });
      expect(screen.getByText('Recorded output').nextElementSibling).toHaveTextContent('20');
      expect(screen.getByText('Recorded reasoning').nextElementSibling).toHaveTextContent('10');
      expect(container.querySelector('.essential-metrics')).not.toHaveTextContent('overlap');
      expect(screen.queryByText('Output', { exact: true })).toBeNull();
      expect(screen.getByText('Output accounting').nextElementSibling).toHaveTextContent(
        'Output/reasoning overlap not established',
      );
      expect(
        screen.getByText('Completion total (including reasoning)').nextElementSibling,
      ).toHaveTextContent('Unknown');
    },
  );

  it('distinguishes unrecorded counters from measured zero without inferring reasoning', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[0];
    call.usage.recordedOutput = null;
    call.usage.reasoning = null;
    const view = render(CallDetails, { props: { call, indexed, pinned: true } });
    expect(screen.getByText('Recorded output').nextElementSibling).toHaveTextContent(
      'Not recorded',
    );
    expect(screen.queryByText('Recorded reasoning')).toBeNull();
    view.unmount();
    call.usage.recordedOutput = 0;
    call.usage.reasoning = 0;
    render(CallDetails, { props: { call, indexed, pinned: true } });
    expect(screen.getByText('Recorded output').nextElementSibling).toHaveTextContent(/^0$/);
    expect(screen.getByText('Recorded reasoning').nextElementSibling).toHaveTextContent(/^0$/);
  });
  it('shows approximate response timing with an accessible qualification, not wall-clock dates or decode speed', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const call = indexed.analysis.modelCalls[0];
    call.timing = {
      startedAtMs: 1700000000000,
      recordedAtMs: 1700000002000,
      durationMs: 2000,
      effectiveOutputTokensPerSecond: 50,
      basis: 'pi-message-timestamps',
    };
    render(CallDetails, { props: { call, indexed, pinned: true } });
    expect(screen.getByText('Response time (approx.)')).toBeInTheDocument();
    expect(screen.getByText('2 s')).toHaveAccessibleDescription(/including waiting and retries/);
    expect(screen.getByText('50 tok\/s')).toHaveAccessibleDescription(
      /reported output, including reasoning, over that time/,
    );
    expect(screen.queryByText('1700000000000')).toBeNull();
  });

  it('shows missing timing as unavailable instead of zero', () => {
    const { container } = renderCall([], []);
    const label = screen.getByText('Response time (approx.)');
    expect(label.nextElementSibling).toHaveTextContent('Unavailable');
    expect(screen.getByText('Effective output rate').nextElementSibling).toHaveTextContent(
      'Unavailable',
    );
    expect(container.querySelector('.essential-metrics')).not.toHaveTextContent('0 tok/s');
  });

  it('renders tool metadata as noninteractive text with an explicit failure label', () => {
    const indexed = indexTestAnalysis(testAnalysis());
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
    const indexed = indexTestAnalysis(testAnalysis());
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
    const indexed = indexTestAnalysis(analysis);
    const { container } = render(CallDetails, {
      props: { call: indexed.analysis.modelCalls[0], indexed, pinned: true },
    });

    expect(container).toHaveTextContent('Non-cache-read input (may include writes)');
    expect(container).toHaveTextContent('Not retained by Pi');
    expect(container).toHaveTextContent('Unavailable; writes may be included in non-read input');
    expect(container).not.toHaveTextContent('Cache write 0');
  });

  it('explains cache-share changes and links to the prior call', async () => {
    const indexed = indexTestAnalysis(testAnalysis());
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

describe('CallDetails cost', () => {
  function renderCost(cost: ModelCall['costAssessment'], source = 'opencode') {
    const analysis = testAnalysis();
    analysis.session.source = source;
    if (source === 'opencode') {
      analysis.reconstruction = {
        status: 'partial',
        explanationCodes: ['missingHistoricalSystemPrompt'],
      };
    }
    const indexed = indexTestAnalysis(analysis);
    const call = indexed.analysis.modelCalls[1];
    call.costAssessment = cost;
    render(CallDetails, { props: { call, indexed, pinned: true } });
    // The value and its label, without the explanation behind the "i" button.
    const value = screen.getByText('Cost').nextElementSibling!.cloneNode(true) as HTMLElement;
    value.querySelector('.info')?.remove();
    return value;
  }

  it('opens the cost explanation beside the cost and closes it with Escape', async () => {
    renderCost(costAssessmentOf('recorded', 0.25), 'pi');
    const trigger = screen.getByRole('button', { name: 'How this cost is worked out' });
    const explanation = document.querySelector('.cost-explanation')!.parentElement!;
    expect(screen.getByText('Cost').nextElementSibling).toContainElement(trigger);
    expect(explanation).not.toBeVisible();
    await fireEvent.click(trigger);
    await tick();
    // Placed on the first open, not only on later ones.
    expect(explanation.getAttribute('style')).toMatch(/left:\s*\d+px;\s*top:\s*\d+px/);
    expect(explanation).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(explanation).not.toBeVisible();
    expect(trigger).toHaveFocus();
  });

  it('labels an API-equivalent range and explains the rate, the inference and the recorded zero', () => {
    const value = renderCost({
      kind: 'apiEquivalent',
      amount: 0.084,
      amountHigh: 0.09,
      recordedByHarness: 0,
      billingMode: 'subscription',
      classificationRule: 'opencodeZeroWithListedPrice',
      rate: {
        provider: 'openai',
        model: 'gpt-5.6-sol',
        labEquivalent: true,
        validFrom: '2026-08-21T00:00:00Z',
        startBasis: 'documented',
        source: 'https://openai.com/index/gpt-5-6/',
      },
    });
    expect(value).toHaveTextContent(/≈ \D*0\.084–\D*0\.090?\s*API-equivalent/);
    const explanation = document.querySelector('.cost-explanation')!;
    expect(explanation).toHaveTextContent('Treated as a subscription');
    expect(explanation).toHaveTextContent('not a charge');
    expect(explanation).toHaveTextContent('reasoning tokens');
    expect(explanation).toHaveTextContent(
      'openai API rate for gpt-5.6-sol, from 21 Aug 2026 (date from the provider)',
    );
    expect(explanation).toHaveTextContent(/Recorded by OpenCode: \D*0\.00?$/);
  });

  it('shows a recorded cost without an estimate rate', () => {
    const value = renderCost(costAssessmentOf('recorded', 0.25), 'pi');
    expect(value).toHaveTextContent(/^\D*0\.25\s*Recorded$/);
    const explanation = document.querySelector('.cost-explanation')!;
    expect(explanation).toHaveTextContent('this is the cost Pi recorded');
    expect(explanation).not.toHaveTextContent('Rate:');
  });

  it('says why a cost is unknown', () => {
    const value = renderCost({
      ...costAssessmentOf('unknown', null),
      classificationRule: 'missingTime',
    });
    expect(value).toHaveTextContent(/^Unknown\s*Unknown$/);
    expect(document.querySelector('.cost-explanation')).toHaveTextContent(
      'no time to choose a price by',
    );
  });
});
