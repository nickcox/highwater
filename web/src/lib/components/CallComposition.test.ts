import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { compositionScenario } from '../testing/composition-scenarios';
import { sessionScenario } from '../testing/session-scenarios';
import CallComposition from './CallComposition.svelte';

afterEach(cleanup);

function props(overrides: Record<string, unknown> = {}) {
  return {
    indexed: indexAnalysis(compositionScenario(220)),
    pinnedCallIndex: 2,
    selectedItemId: null,
    isVisible: true,
    onPinCall: vi.fn(),
    onUnpinCall: vi.fn(),
    onSelectItem: vi.fn(),
    onRevealInRiver: vi.fn(),
    onViewDetails: vi.fn(),
    onFindInLifespans: vi.fn(),
    ...overrides,
  };
}

describe('CallComposition', () => {
  it('labels all-unavailable totals as Unknown in both scopes', async () => {
    const indexed = indexAnalysis(sessionScenario('unavailableGeometry'));
    render(CallComposition, { props: props({ indexed, pinnedCallIndex: 2 }) });

    expect(document.querySelector('.composition-totals strong')).toHaveTextContent(
      'Unknown estimated token-turns',
    );
    await fireEvent.click(screen.getByRole('button', { name: 'At call' }));
    expect(document.querySelector('.composition-totals strong')).toHaveTextContent(
      'Unknown estimated item tokens',
    );
  });

  it('defaults to cumulative, keeps scope independent of pin, and exposes explicit endpoint actions', async () => {
    const onPinCall = vi.fn();
    const onUnpinCall = vi.fn();
    const onSelectItem = vi.fn();
    const indexed = indexAnalysis(compositionScenario(20));
    const calls = indexed.analysis.modelCalls;
    const view = render(CallComposition, {
      props: props({ indexed, pinnedCallIndex: null, onPinCall, onUnpinCall, onSelectItem }),
    });
    expect(screen.getByRole('button', { name: 'Cumulative' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Whole session' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Inspect adjacent calls' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Inspect latest call' })).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'At call' }));
    expect(screen.getByText(/Pin a call to inspect its item estimates/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect latest call' }));
    expect(onPinCall).toHaveBeenCalledWith(calls[calls.length - 1].index);

    await view.rerender(
      props({ indexed, pinnedCallIndex: 2, onPinCall, onUnpinCall, onSelectItem }),
    );
    expect(
      screen.getByRole('heading', { name: 'Context composition · Call 2' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect previous call' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Inspect next call' })).toBeEnabled();
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect next call' }));
    expect(onPinCall).toHaveBeenLastCalledWith(3);
    expect(onSelectItem).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole('button', { name: 'Cumulative' }));
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Calls 1–2' }),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Whole session' }));
    expect(onUnpinCall).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Calls 1–2' }),
    ).toBeInTheDocument();
  });

  it('uses the selected call profile, complete List access, and scoped selected-item actions', async () => {
    const onPinCall = vi.fn();
    const onSelectItem = vi.fn();
    const onRevealInRiver = vi.fn();
    const onViewDetails = vi.fn();
    const onFindInLifespans = vi.fn();
    const view = render(CallComposition, {
      props: props({
        onPinCall,
        onSelectItem,
        onRevealInRiver,
        onViewDetails,
        onFindInLifespans,
      }),
    });
    await fireEvent.click(screen.getByRole('button', { name: 'At call' }));
    const tree = screen.getByRole('listbox', { name: /Context composition · Call 2 treemap/ });
    expect(screen.getByText(/Estimated tokens · 220 present items/)).toBeInTheDocument();
    expect(screen.getByText('Compare with provider usage')).toBeInTheDocument();
    expect(document.querySelector('.reconciliation')).not.toHaveAttribute('open', '');
    expect(screen.getByText('Provider prompt')).not.toBeVisible();
    await fireEvent.click(screen.getByText('Composition help'));
    expect(screen.getByText(/Areas are approximate/)).toBeInTheDocument();
    await fireEvent.click(screen.getByText('Compare with provider usage'));
    expect(screen.getByText('Provider prompt')).toBeInTheDocument();
    expect(tree.querySelectorAll('[role="option"]').length).toBeGreaterThan(200);
    expect(tree.querySelector('[data-composition-item="composition-item-001"]')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('8K estimated tokens'),
    );
    expect(tree.querySelector('[data-composition-item="composition-item-004"]')).not.toBeNull();
    expect(tree.querySelectorAll('[role="option"][tabindex="0"]')).toHaveLength(0);
    expect(tree).toHaveAttribute('tabindex', '0');

    const initialActive = tree.getAttribute('aria-activedescendant');
    await fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(tree.getAttribute('aria-activedescendant')).not.toBe(initialActive);
    const activeItemId = document
      .getElementById(tree.getAttribute('aria-activedescendant')!)
      ?.getAttribute('data-composition-item');
    await fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onSelectItem).toHaveBeenCalledWith(activeItemId);
    expect(onPinCall).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(
      screen.getByRole('option', { name: /Image content is not fully counted/ }),
    ).toHaveAccessibleName(/Text counts may omit image payload tokens/);
    expect(
      screen.getByRole('option', { name: /Image content is not fully counted/ }),
    ).toHaveAccessibleName(/estimate coverage partial/);

    await view.rerender(
      props({
        selectedItemId: 'composition-item-000',
        onPinCall,
        onSelectItem,
        onRevealInRiver,
        onViewDetails,
        onFindInLifespans,
      }),
    );
    expect(document.querySelector('[data-composition-item="composition-item-000"]')).toHaveClass(
      'selected',
    );
    expect(document.querySelector('.selected-composition-item')).toHaveTextContent(
      'estimated tokens',
    );
    await fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Find in lifespans' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Reveal in River' }));
    expect(onViewDetails).toHaveBeenCalledOnce();
    expect(onFindInLifespans).toHaveBeenCalledWith('composition-item-000');
    expect(onRevealInRiver).toHaveBeenCalledWith('composition-item-000');
  });

  it('aggregates a selected item over the pinned prefix and explains out-of-scope selection', async () => {
    const indexed = indexAnalysis(compositionScenario(20));
    const onUnpinCall = vi.fn();
    const view = render(CallComposition, {
      props: props({
        indexed,
        pinnedCallIndex: 2,
        selectedItemId: 'composition-item-002',
        onUnpinCall,
      }),
    });
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Calls 1–2' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.composition-totals strong')).toHaveTextContent(
      'estimated token-turns',
    );
    expect(screen.getByText(/Known subtotal/)).toBeInTheDocument();

    const afterEndpoint = { ...indexed.analysis.contextItems[0], id: 'after-endpoint' };
    indexed.itemById.set(afterEndpoint.id, afterEndpoint);
    await view.rerender(props({ indexed, pinnedCallIndex: 1, selectedItemId: 'after-endpoint' }));
    expect(screen.getByText(/No contribution within this cumulative scope/)).toBeInTheDocument();
  });

  it('shows every zero and unavailable item in List without promoting zero areas', async () => {
    const zero = indexAnalysis(compositionScenario(220, true));
    const view = render(CallComposition, { props: props({ indexed: zero }) });
    expect(screen.getByText(/All numeric item estimates are zero/)).toBeInTheDocument();
    expect(
      screen.getByRole('listbox', { name: /items ranked by estimated contribution/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Treemap' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('option')).toHaveLength(220);

    await fireEvent.click(screen.getByRole('button', { name: 'List' }));
    const normal = indexAnalysis(compositionScenario(220));
    await view.rerender(props({ indexed: normal }));
    expect(
      screen.getByRole('listbox', { name: /items ranked by estimated contribution/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(screen.getByRole('button', { name: 'Treemap' }));
    expect(screen.getByRole('listbox', { name: /treemap/ })).toBeInTheDocument();
  });

  it('keeps presence-less sessions free of reveal and latest-call actions', async () => {
    const empty = indexAnalysis(sessionScenario('terminalSummaryOnly'));
    render(CallComposition, {
      props: props({ indexed: empty, pinnedCallIndex: null, selectedItemId: null }),
    });
    expect(screen.queryByRole('button', { name: 'Reveal in River' })).toBeNull();
    expect(screen.getByText(/has no model calls/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspect latest call' })).toBeNull();
  });
});
