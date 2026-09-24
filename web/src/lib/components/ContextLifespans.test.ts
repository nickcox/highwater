import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexAnalysis } from '../analysis';
import { resetInteraction } from '../state/interaction';
import { testAnalysis } from '../context-river/test-data';
import { sessionScenario } from '../testing/session-scenarios';
import ContextLifespans from './ContextLifespans.svelte';

const emptyHover = () => {};
afterEach(cleanup);

describe('ContextLifespans browsing', () => {
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
        indexed: indexAnalysis(analysis),
        interaction: resetInteraction(),
        onSelectItem: vi.fn(),
        onHoverItem: emptyHover,
      },
    });

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
    expect(screen.getByText('4 of 4 items')).toBeInTheDocument();
  });

  it('filters to an empty state without discarding the selected item', async () => {
    const onSelectItem = vi.fn<(id: string) => void>();
    render(ContextLifespans, {
      props: {
        indexed: indexAnalysis(testAnalysis()),
        interaction: { ...resetInteraction(), selectedItemId: 'a' },
        selectedItemId: 'a',
        onSelectItem,
        onHoverItem: emptyHover,
      },
    });

    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'not in this session' },
    });
    expect(screen.getByText('0 of 4 items')).toBeInTheDocument();
    expect(screen.getByText(/selected item is hidden by these filters/i)).toBeInTheDocument();
    expect(screen.getByText(/No items match these filters/)).toBeInTheDocument();
  });

  it('sorts by first appearance and size under one shared profile', async () => {
    const indexed = indexAnalysis(testAnalysis());
    const { container } = render(ContextLifespans, {
      props: {
        indexed,
        interaction: resetInteraction(),
        onSelectItem: vi.fn(),
        onHoverItem: emptyHover,
      },
    });
    const labels = () =>
      [...container.querySelectorAll('.item-label')].map((element) => element.textContent);

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
  });

  it('keeps search state through same-session analysis replacement', async () => {
    const onSelectItem = vi.fn<(id: string) => void>();
    const props = {
      indexed: indexAnalysis(testAnalysis()),
      interaction: resetInteraction(),
      onSelectItem,
      onHoverItem: emptyHover,
    };
    const { rerender } = render(ContextLifespans, { props });
    const search = screen.getByRole('searchbox', { name: 'Search items' });
    await fireEvent.input(search, { target: { value: 'bash' } });

    const replacement = testAnalysis();
    replacement.modelCalls[1].model = 'replacement-model';
    await rerender({ ...props, indexed: indexAnalysis(replacement) });
    expect(screen.getByRole('searchbox', { name: 'Search items' })).toHaveValue('bash');
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();
  });

  it('keeps presence-less terminal summaries discoverable and selectable', async () => {
    const onSelectItem = vi.fn<(id: string) => void>();
    render(ContextLifespans, {
      props: {
        indexed: indexAnalysis(sessionScenario('terminalSummaryOnly')),
        interaction: resetInteraction(),
        onSelectItem,
        onHoverItem: emptyHover,
      },
    });

    expect(screen.getByText('1 of 1 items')).toBeInTheDocument();
    expect(screen.getByText(/No model-call presence/)).toBeInTheDocument();
    await fireEvent.click(
      screen.getByRole('button', {
        name: 'Select Terminal compaction summary; no model-call presence',
      }),
    );
    expect(onSelectItem).toHaveBeenCalledWith('terminal-summary');
  });
});
