import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testAnalysis } from '../context-river/test-data';
import { sessionScenario } from '../testing/session-scenarios';
import { versionScenario } from '../testing/version-scenario';
import ItemDetails from './ItemDetails.svelte';
import { inspectorSections } from '../state/inspector-sections';

afterEach(cleanup);

describe('ItemDetails presence feedback', () => {
  it('inspects first inclusion independently of estimate and pin, hiding only at that pin', async () => {
    const indexed = indexTestAnalysis(testAnalysis());
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
    expect(screen.queryByRole('button', { name: /Inspect first included call/ })).toBeNull();
    await view.rerender({ pinnedCallIndex: 2, callIndex: 2 });
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect first included call · 1' }));
    expect(onInspectCall).toHaveBeenLastCalledWith(1);
    await view.rerender({ pinnedCallIndex: 4, callIndex: 4 });
    expect(
      screen.getByRole('button', { name: 'Inspect first included call · 1' }),
    ).toBeInTheDocument();
    await view.rerender({ pinnedCallIndex: null, callIndex: null });
    expect(
      screen.getByRole('button', { name: 'Inspect first included call · 1' }),
    ).toBeInTheDocument();
    await view.rerender({ item: indexed.itemById.get('retained')! });
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect first included call · 2' }));
    expect(onInspectCall).toHaveBeenLastCalledWith(2);
    await view.rerender({ pinnedCallIndex: 2 });
    expect(screen.queryByRole('button', { name: /Inspect first included call/ })).toBeNull();
    await view.rerender({
      item: { ...indexed.itemById.get('summary')!, presence: [] },
      pinnedCallIndex: null,
    });
    expect(screen.queryByRole('button', { name: /Inspect first included call/ })).toBeNull();
  });
  it('omits the bulk-collapse action and preserves manually chosen sections across panel reopening', async () => {
    const indexed = indexTestAnalysis(testAnalysis());
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
    const indexed = indexTestAnalysis(testAnalysis());
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
    // Show more already signals more content, so the compact preview needs no note.
    expect(screen.queryByText(/Compact preview truncated/)).toBeNull();
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
    const indexed = indexTestAnalysis(testAnalysis());
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
    const indexed = indexTestAnalysis(sessionScenario('terminalSummaryOnly'));
    render(ItemDetails, {
      props: { item: indexed.analysis.contextItems[0], indexed },
    });

    expect(
      screen.getByText(/has no model-call presence.*no location to reveal/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reveal in River' })).toBeNull();
  });
});

describe('ItemDetails versions', () => {
  it('lists the versions and what changed with each new system prompt', async () => {
    const indexed = indexTestAnalysis(versionScenario());
    const onSelectItem = vi.fn();
    render(ItemDetails, { props: { item: indexed.itemById.get('s3')!, indexed, onSelectItem } });
    expect(screen.getByText('System · version 3 of 3')).toBeInTheDocument();
    expect(screen.getByText('Version 3 · call 4 · 110 tokens · this version')).toBeInTheDocument();
    expect(
      screen.getByText('Call 2: tools added: fetch, source_check, web_search'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Call 4: tool definitions changed: web_search; tools removed: fetch'),
    ).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole('button', { name: 'Version 2 · calls 2–3 · 120 tokens' }),
    );
    expect(onSelectItem).toHaveBeenLastCalledWith('s2');
  });

  it('lists tool definition versions without describing the change', () => {
    const indexed = indexTestAnalysis(versionScenario());
    render(ItemDetails, { props: { item: indexed.itemById.get('web1')!, indexed } });
    expect(screen.getByText('Tool Definition · version 1 of 2')).toBeInTheDocument();
    expect(screen.queryByText(/^Call \d+:/)).toBeNull();
  });
});
