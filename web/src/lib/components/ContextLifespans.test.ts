import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testAnalysis } from '../context-river/test-data';
import { sessionScenario } from '../testing/session-scenarios';
import { compositionScenario } from '../testing/composition-scenarios';
import { versionScenario } from '../testing/version-scenario';
import ContextLifespans from './ContextLifespans.svelte';

const emptyHover = () => {};
let restoreScrollIntoView = () => {};
afterEach(() => {
  cleanup();
  restoreScrollIntoView();
  restoreScrollIntoView = () => {};
});

function stubScrollIntoView() {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  });
  restoreScrollIntoView = () => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  };
  return scroll;
}

async function expandLifespans(): Promise<void> {
  const disclosure = document.querySelector('.lifespan-disclosure') as HTMLDetailsElement | null;
  if (disclosure && !disclosure.open) {
    await fireEvent.click(disclosure.querySelector('summary')!);
    await waitFor(() => expect(disclosure.querySelector('.lifespan-content')).not.toBeNull());
  }
}

describe('ContextLifespans browsing', () => {
  it('distinguishes pointer positions from label and keyboard activation, without pinning on hover', async () => {
    const onSelectItem = vi.fn();
    const onHoverItem = vi.fn();
    const view = render(ContextLifespans, {
      props: {
        indexed: indexTestAnalysis(testAnalysis()),
        onSelectItem,
        onHoverItem,
        pinnedCallIndex: 4,
      },
    });
    await expandLifespans();
    const row = view.container.querySelector('[data-lifespan-item-id="a"]')!;
    const segment = row.querySelector('.segment')!;
    const track = row.querySelector('.track')!;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 300 } as DOMRect);
    await fireEvent.pointerEnter(segment, { clientX: 180 });
    expect(onHoverItem).toHaveBeenCalled();
    expect(onSelectItem).not.toHaveBeenCalled();
    await fireEvent.click(segment, { detail: 1, clientX: 190 });
    expect(onSelectItem).toHaveBeenLastCalledWith('a', 2);
    await fireEvent.click(segment, { detail: 1, clientX: 101 });
    expect(onSelectItem).toHaveBeenLastCalledWith('a', 1);
    await fireEvent.click(segment, { detail: 1, clientX: 399 });
    expect(onSelectItem).toHaveBeenLastCalledWith('a', 2);
    await fireEvent.click(segment, { detail: 0, clientX: 399 });
    expect(onSelectItem).toHaveBeenLastCalledWith('a');
    await fireEvent.click(row.querySelector('.item-label')!, { detail: 1 });
    expect(onSelectItem).toHaveBeenLastCalledWith('a');
    const gap = view.container.querySelectorAll('[data-lifespan-item-id="gap"] .segment');
    vi.spyOn(
      view.container.querySelector('[data-lifespan-item-id="gap"] .track')!,
      'getBoundingClientRect',
    ).mockReturnValue({ left: 100, width: 300 } as DOMRect);
    await fireEvent.click(gap[0], { detail: 1, clientX: 250 });
    expect(onSelectItem).toHaveBeenLastCalledWith('gap', 1);
    await fireEvent.click(gap[1], { detail: 1, clientX: 250 });
    expect(onSelectItem).toHaveBeenLastCalledWith('gap', 4);
  });
  it('does not repeat instructions already represented by labels and contextual help', () => {
    const { container } = render(ContextLifespans, {
      props: {
        indexed: indexTestAnalysis(testAnalysis()),
        onSelectItem: vi.fn(),
        onHoverItem: emptyHover,
      },
    });
    expect(container.querySelector('.lifespan-header p')).toBeNull();
    expect(container.querySelector('#lifespan-search-help')).toBeNull();
    expect((container.querySelector('.lifespan-disclosure') as HTMLDetailsElement).open).toBe(
      false,
    );
  });

  it('searches bounded labels and previews and clears search and kind filters', async () => {
    const analysis = testAnalysis();
    analysis.contextItems[1].preview = {
      text: 'a bounded searchable excerpt',
      kind: 'text',
      truncated: false,
      expandedText: 'a bounded searchable excerpt',
      expandedTruncated: false,
    };
    render(ContextLifespans, {
      props: {
        indexed: indexTestAnalysis(analysis),
        onSelectItem: vi.fn(),
        onHoverItem: emptyHover,
      },
    });
    await expandLifespans();

    const search = screen.getByRole('searchbox', { name: 'Search items' });
    expect(search).toHaveAttribute('maxlength', '120');
    await fireEvent.input(search, { target: { value: 'bounded searchable' } });
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();
    expect(screen.getByText('retained tail')).toBeInTheDocument();

    await fireEvent.change(screen.getByRole('combobox', { name: 'Filter by kind' }), {
      target: { value: 'userMessage' },
    });
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
    expect(
      screen.getByRole('heading', { name: 'Context lifespans · 4 items' }),
    ).toBeInTheDocument();
  });

  it('filters to an empty state without discarding the selected item', async () => {
    const onSelectItem = vi.fn<(id: string) => void>();
    render(ContextLifespans, {
      props: {
        indexed: indexTestAnalysis(testAnalysis()),
        selectedItemId: 'a',
        onSelectItem,
        onHoverItem: emptyHover,
      },
    });
    await expandLifespans();

    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'not in this session' },
    });
    expect(screen.getByText('0 of 4 items')).toBeInTheDocument();
    expect(screen.getByText(/selected item is hidden by these filters/i)).toBeInTheDocument();
    expect(screen.getByText(/No items match these filters/)).toBeInTheDocument();
  });

  it('sorts by first appearance and size under one shared profile', async () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const { container } = render(ContextLifespans, {
      props: {
        indexed,
        onSelectItem: vi.fn(),
        onHoverItem: emptyHover,
      },
    });
    const labels = () =>
      [...container.querySelectorAll('.item-label')].map((element) => element.textContent);
    await expandLifespans();

    await fireEvent.change(screen.getByRole('combobox', { name: 'Sort items' }), {
      target: { value: 'firstAppearance' },
    });
    expect(labels()).toEqual([
      'bash: npm test',
      '<img src=x onerror=alert(1)>',
      'retained tail',
      'Compaction summary',
    ]);

    await fireEvent.change(screen.getByRole('combobox', { name: 'Sort items' }), {
      target: { value: 'size' },
    });
    expect(screen.getByText(/Size uses one shared profile/)).toBeInTheDocument();
    expect(labels()).toEqual([
      'bash: npm test',
      'Compaction summary',
      'retained tail',
      '<img src=x onerror=alert(1)>',
    ]);

    await fireEvent.change(screen.getByRole('combobox', { name: 'Sort items' }), {
      target: { value: 'presenceCount' },
    });
    expect(labels()).toEqual([
      'retained tail',
      'bash: npm test',
      'Compaction summary',
      '<img src=x onerror=alert(1)>',
    ]);
  });

  it('scopes items to a pinned call and restores All items when the pin disappears', async () => {
    const indexed = indexTestAnalysis(testAnalysis());
    const props = {
      indexed,
      selectedItemId: 'summary',
      pinnedCallIndex: 2,
      onSelectItem: vi.fn(),
      onHoverItem: emptyHover,
    };
    const { container, rerender } = render(ContextLifespans, { props });
    await expandLifespans();
    const scope = screen.getByRole('combobox', { name: 'Scope context items' });
    expect(scope).toHaveValue('all');
    expect(scope.querySelector('option[value="presentAtPin"]')).not.toBeDisabled();
    expect(container.querySelector('.axis-pin-marker')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.pin-marker')).toHaveAttribute('aria-hidden', 'true');

    await fireEvent.change(scope, { target: { value: 'presentAtPin' } });
    expect(screen.getByText('2 of 4 items')).toBeInTheDocument();
    expect(screen.getByText(/selected item is hidden by these filters/i)).toBeInTheDocument();
    expect([...container.querySelectorAll('.item-label')].map((node) => node.textContent)).toEqual([
      'bash: npm test',
      'retained tail',
    ]);

    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'bash' },
    });
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search items' })).toHaveValue('');
    expect(scope).toHaveValue('all');
    expect(
      screen.getByRole('heading', { name: 'Context lifespans · 4 items' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.row.selected')).toBeTruthy();
    await fireEvent.change(scope, { target: { value: 'presentAtPin' } });

    await rerender({ ...props, pinnedCallIndex: null });
    expect(scope).toHaveValue('all');
    expect(
      screen.getByRole('heading', { name: 'Context lifespans · 4 items' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Pin cleared; showing all items.');
  });

  it('keeps search state through same-session analysis replacement', async () => {
    const onSelectItem = vi.fn<(id: string) => void>();
    const props = {
      indexed: indexTestAnalysis(testAnalysis()),
      onSelectItem,
      onHoverItem: emptyHover,
    };
    const { container, rerender } = render(ContextLifespans, { props });
    await expandLifespans();
    expect((container.querySelector('.lifespan-disclosure') as HTMLDetailsElement).open).toBe(true);
    const search = screen.getByRole('searchbox', { name: 'Search items' });
    await fireEvent.input(search, { target: { value: 'bash' } });

    const replacement = testAnalysis();
    replacement.modelCalls[1].model = 'replacement-model';
    await rerender({ ...props, indexed: indexTestAnalysis(replacement) });
    expect(screen.getByRole('searchbox', { name: 'Search items' })).toHaveValue('bash');
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();
    expect((container.querySelector('.lifespan-disclosure') as HTMLDetailsElement).open).toBe(true);
  });

  it('opens and focuses the selected row from an explicit Find request', async () => {
    const scroll = stubScrollIntoView();
    render(ContextLifespans, {
      props: {
        indexed: indexTestAnalysis(testAnalysis()),
        selectedItemId: 'a',
        onSelectItem: vi.fn(),
        onHoverItem: emptyHover,
        findRequest: { requestId: 1, itemId: 'a' },
      },
    });

    const row = await screen.findByLabelText(/bash: npm test; Tool result/);
    await waitFor(() => expect(row).toHaveFocus());
    expect((document.querySelector('.lifespan-disclosure') as HTMLDetailsElement).open).toBe(true);
    expect(scroll).toHaveBeenCalledOnce();
  });

  it('offers an explicit filter reset when Find targets a filtered-out selection', async () => {
    stubScrollIntoView();
    const props = {
      indexed: indexTestAnalysis(testAnalysis()),
      selectedItemId: 'a',
      onSelectItem: vi.fn(),
      onHoverItem: emptyHover,
    };
    const view = render(ContextLifespans, { props });
    await expandLifespans();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'not a matching label' },
    });
    await view.rerender({ ...props, findRequest: { requestId: 2, itemId: 'a' } });
    const reset = await screen.findByRole('button', { name: 'Reset filters and find item' });
    expect(reset).toHaveFocus();
    await fireEvent.click(reset);
    const row = await screen.findByLabelText(/bash: npm test; Tool result/);
    await waitFor(() => expect(row).toHaveFocus());
    expect(screen.getByRole('combobox', { name: 'Scope context items' })).toHaveValue('all');
  });

  it('keeps presence-less terminal summaries discoverable and selectable', async () => {
    const onSelectItem = vi.fn<(id: string) => void>();
    render(ContextLifespans, {
      props: {
        indexed: indexTestAnalysis(sessionScenario('terminalSummaryOnly')),
        onSelectItem,
        onHoverItem: emptyHover,
      },
    });

    await expandLifespans();
    expect(screen.getByRole('heading', { name: 'Context lifespans · 1 item' })).toBeInTheDocument();
    expect(screen.getByText(/No model-call presence/)).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole('button', {
        name: 'Select Terminal compaction summary; no model-call presence',
      }),
    );
    expect(onSelectItem).toHaveBeenCalledWith('terminal-summary');
  });
});

describe('ContextLifespans long sessions', () => {
  it('renders matching rows a page at a time', async () => {
    const indexed = indexTestAnalysis(compositionScenario(220));
    const total = indexed.analysis.contextItems.length;
    expect(total).toBeGreaterThan(200);
    render(ContextLifespans, {
      props: { indexed, onSelectItem: vi.fn(), onHoverItem: emptyHover },
    });
    await expandLifespans();
    expect(document.querySelectorAll('[data-lifespan-item-id]')).toHaveLength(200);
    expect(document.querySelector('.more-rows')).toHaveTextContent(`Showing 200 of ${total} items`);
    await fireEvent.click(screen.getByRole('button', { name: `Show ${total - 200} more` }));
    expect(document.querySelectorAll('[data-lifespan-item-id]')).toHaveLength(total);
    expect(document.querySelector('.more-rows')).toBeNull();
  });

  it('extends the page to reach a requested item beyond it', async () => {
    stubScrollIntoView();
    const indexed = indexTestAnalysis(compositionScenario(220));
    const props = { indexed, onSelectItem: vi.fn(), onHoverItem: emptyHover };
    const view = render(ContextLifespans, { props });
    await expandLifespans();
    const rendered = new Set(
      [...document.querySelectorAll<HTMLElement>('[data-lifespan-item-id]')].map(
        (row) => row.dataset.lifespanItemId,
      ),
    );
    const beyond = indexed.analysis.contextItems.find((item) => !rendered.has(item.id))!;
    await view.rerender({ ...props, findRequest: { requestId: 1, itemId: beyond.id } });
    await waitFor(() =>
      expect((document.activeElement as HTMLElement | null)?.dataset.lifespanItemId).toBe(
        beyond.id,
      ),
    );
  });
});

describe('ContextLifespans versions', () => {
  it('shows every version of the system prompt on one row and selects the version clicked', async () => {
    const onSelectItem = vi.fn();
    const view = render(ContextLifespans, {
      props: {
        indexed: indexTestAnalysis(versionScenario()),
        onSelectItem,
        onHoverItem: emptyHover,
      },
    });
    await expandLifespans();
    const rows = [...view.container.querySelectorAll<HTMLElement>('[data-lifespan-item-id]')];
    expect(rows.map((row) => row.dataset.lifespanItemId).sort()).toEqual([
      'check',
      'fetch',
      'read',
      's1',
      'user',
      'web1',
    ]);
    const system = view.container.querySelector('[data-lifespan-item-id="s1"]')!;
    expect(system).toHaveAttribute(
      'aria-label',
      'System prompt; System; Present at calls 1–4 · 3 versions',
    );
    expect(system.querySelectorAll('.version-mark')).toHaveLength(2);
    expect(system.querySelector('.meta')).toHaveTextContent('450');
    await fireEvent.click(
      screen.getByRole('button', { name: 'System prompt version 3, calls 4 through 4' }),
    );
    expect(onSelectItem).toHaveBeenLastCalledWith('s3');
    await view.rerender({ selectedItemId: 's2' });
    expect(system).toHaveClass('selected');
  });
});
