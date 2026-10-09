import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from '../context-river/test-data';
import { sessionScenario } from '../testing/session-scenarios';
import ItemDetails from './ItemDetails.svelte';
import { inspectorSections } from '../state/inspector-sections';

afterEach(cleanup);

describe('ItemDetails presence feedback', () => {
  it('hides Inspect call only when its target is already pinned', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const onInspectCall = vi.fn();
    const view = render(ItemDetails, {
      props: {
        item: indexed.itemById.get('a')!,
        indexed,
        callIndex: 1,
        pinnedCallIndex: 1,
        onInspectCall,
      },
    });
    expect(screen.queryByRole('button', { name: /Inspect call/ })).toBeNull();
    await view.rerender({ pinnedCallIndex: null });
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect call 1' }));
    expect(onInspectCall).toHaveBeenLastCalledWith(1);
    await view.rerender({ pinnedCallIndex: 2 });
    expect(screen.getByRole('button', { name: 'Inspect call 1' })).toBeInTheDocument();
    await view.rerender({ callIndex: 2 });
    expect(screen.queryByRole('button', { name: /Inspect call/ })).toBeNull();
    await view.rerender({ pinnedCallIndex: null, callIndex: null });
    expect(screen.getByRole('button', { name: 'Inspect call 2' })).toBeInTheDocument();
  });
  it('closes the item from its identity header without invoking call inspection', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const onClear = vi.fn();
    const onInspectCall = vi.fn();
    const view = render(ItemDetails, {
      props: {
        item: indexed.itemById.get('a')!,
        indexed,
        pinnedCallIndex: 1,
        onClear,
        onInspectCall,
      },
    });
    const close = screen.getByRole('button', { name: 'Close context item' });
    expect(close.closest('header')).toBe(view.container.querySelector('.item-identity'));
    expect(close).toHaveTextContent('×');
    expect(screen.queryByRole('button', { name: 'Clear item' })).toBeNull();
    await fireEvent.click(close);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onInspectCall).not.toHaveBeenCalled();
  });
  it('omits the bulk-collapse action and preserves manually chosen sections across panel reopening', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const sections = {
      ...inspectorSections(),
      identifiers: true,
      preview: true,
      expandedPreview: true,
    };
    const item = {
      ...indexed.itemById.get('a')!,
      preview: {
        kind: 'toolResult' as const,
        text: 'Compact preview',
        expandedText: 'Expanded preview',
        truncated: false,
        expandedTruncated: false,
      },
    };
    const view = render(ItemDetails, { props: { item, indexed, sections, pinnedCallIndex: 1 } });
    expect(screen.queryByRole('button', { name: 'Collapse details' })).toBeNull();
    expect(view.container.querySelector('.technical-identifiers')).toHaveAttribute('open', '');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await view.rerender({ item: null });
    await view.rerender({ item });
    expect(view.container.querySelector('.technical-identifiers')).toHaveAttribute('open', '');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const identifiers = view.container.querySelector(
      '.technical-identifiers',
    ) as HTMLDetailsElement;
    identifiers.open = false;
    await fireEvent(identifiers, new Event('toggle'));
    await view.rerender({ item: null });
    await view.rerender({ item });
    expect(view.container.querySelector('.technical-identifiers')).not.toHaveAttribute('open', '');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Collapse details' })).toBeNull();
  });
  it('restores read-more choices, switches truncation hints, and omits the control without extra content', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const item = {
      ...indexed.itemById.get('a')!,
      preview: {
        kind: 'toolResult' as const,
        text: 'Compact',
        expandedText: 'Expanded <img src=x>',
        truncated: true,
        expandedTruncated: true,
      },
    };
    const sections = { ...inspectorSections(), preview: true, expandedPreview: true };
    const view = render(ItemDetails, { props: { item, indexed, sections } });
    expect(view.container.querySelector('.preview-details details')).toBeNull();
    expect(view.container.querySelector('.preview-details pre')).toHaveTextContent(
      'Expanded <img src=x>',
    );
    expect(view.container.querySelector('img')).toBeNull();
    expect(screen.getByText('Expanded preview truncated.')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(view.container.querySelector('.content-preview')).toHaveTextContent('Compact');
    expect(screen.getByText(/Compact preview truncated/)).toBeInTheDocument();
    expect(screen.queryByText('Expanded preview truncated.')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await view.rerender({ item: null });
    await view.rerender({ item });
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await view.rerender({
      item: {
        ...item,
        preview: { ...item.preview, expandedText: 'Compact', expandedTruncated: false },
      },
    });
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show less' })).toBeNull();
    expect(view.container.querySelector('.preview-details pre')).toBeNull();
  });

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
