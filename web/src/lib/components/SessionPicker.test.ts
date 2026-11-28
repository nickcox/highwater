import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SessionPicker from './SessionPicker.svelte';
import type { SessionListItem } from '../api/client';
const session = (id: string, overrides: Partial<SessionListItem> = {}): SessionListItem => ({
  id,
  harness: 'pi',
  displayName: id,
  fileName: id + '.jsonl',
  workingDirectory: '/code/project',
  startedAt: null,
  modifiedAt: null,
  byteSize: 10,
  ...overrides,
});
const sessions = [
  session('pi-one', { displayName: 'First task', firstPrompt: 'Fix tests' }),
  session('codex-two', { harness: 'codex', displayName: 'Second task' }),
];
afterEach(cleanup);
const button = () => screen.getByRole('button', { name: /^Session:/ });
const search = () => screen.getByRole('textbox', { name: 'Search sessions' });
const grid = () => screen.getByRole('grid', { name: 'Sessions' });
function setup(rows = sessions) {
  const onSelect = vi.fn();
  render(SessionPicker, { props: { sessions: rows, selectedId: 'pi-one', onSelect } });
  return onSelect;
}
describe('session table control', () => {
  it('has one session button and moves the filters into the expanded table', async () => {
    setup();
    expect(button()).toHaveTextContent('[Pi] First task · project');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await fireEvent.click(button());
    expect(search()).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Harness' })).toBeVisible();
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    await fireEvent.click(button());
    expect(button()).toHaveFocus();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
  it('opens with typed search, navigates between search and rows, and returns focus after selection', async () => {
    const onSelect = setup();
    button().focus();
    await fireEvent.keyDown(button(), { key: 't' });
    expect(search()).toHaveValue('t');
    await fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(grid()).toHaveFocus();
    await fireEvent.keyDown(grid(), { key: 'ArrowUp' });
    expect(search()).toHaveFocus();
    await fireEvent.keyDown(search(), { key: 'ArrowDown' });
    await fireEvent.keyDown(grid(), { key: 's' });
    expect(search()).toHaveFocus();
    expect(search()).toHaveValue('ts');
    await fireEvent.input(search(), { target: { value: 'Second' } });
    await fireEvent.keyDown(search(), { key: 'ArrowDown' });
    await fireEvent.keyDown(grid(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('codex-two');
    expect(button()).toHaveFocus();
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });
  it('does not treat modifiers or composing keys as printable search, and accepts composition text', async () => {
    setup();
    await fireEvent.keyDown(button(), { key: 'a', ctrlKey: true });
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.keyDown(button(), { key: 'a', isComposing: true });
    expect(search()).toHaveValue('');
    const control = button();
    await fireEvent.compositionStart(control);
    await fireEvent.compositionEnd(control, { data: '日本' });
    expect(search()).toHaveValue('日本');
  });
  it('counts harness filters, keeps the open session visible in the button and clears harness but not children', async () => {
    setup();
    await fireEvent.click(button());
    await fireEvent.change(screen.getByRole('combobox', { name: 'Harness' }), {
      target: { value: 'codex' },
    });
    expect(button()).toHaveAccessibleName(/1 filter/);
    expect(button()).toHaveTextContent('First task');
    expect(screen.getByText('The open session is hidden by these filters.')).toBeVisible();
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Child sessions' }));
    await fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(screen.getByRole('combobox', { name: 'Harness' })).toHaveValue('all');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(button()).not.toHaveAccessibleName(/filter/);
  });
  it('closes with Escape without clearing the River selection', async () => {
    setup();
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    await fireEvent.click(button());
    await fireEvent.keyDown(search(), { key: 'Escape' });
    expect(button()).toHaveFocus();
    expect(outside).not.toHaveBeenCalled();
    document.removeEventListener('keydown', outside);
  });
  it('shows no-match text and clears the only search', async () => {
    setup();
    await fireEvent.click(button());
    await fireEvent.input(search(), { target: { value: 'absent' } });
    expect(screen.getByText('No sessions match these filters.')).toBeVisible();
    await fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(search()).toHaveValue('');
  });
  it('combines costs and preserves narrow separators and distinct references', async () => {
    const total = { usd: 3, kind: 'sum' as const, partial: false, sinceMs: null };
    const rows = [
      session('pi-one', { firstPrompt: 'Prompt', total }),
      session('child', { parentReference: 'pi-one', total: { ...total, usd: 1 } }),
      session('empty'),
    ];
    const onSelect = setup([...rows, rows[0]]);
    await fireEvent.click(button());
    expect(grid()).toHaveTextContent('$4.00');
    expect(
      [...grid().querySelectorAll('.narrow-project')].map((span) =>
        span.parentElement?.textContent?.trim(),
      ),
    ).toEqual(['project', 'project · Prompt']);
    await fireEvent.click(grid().querySelector('[data-session-id="pi-one"]')!);
    expect(onSelect).not.toHaveBeenCalled();
    expect(button()).toHaveFocus();
  });
  it('says Choose a session when nothing is selected', () => {
    render(SessionPicker, { props: { sessions, selectedId: null, onSelect: vi.fn() } });
    expect(button()).toHaveTextContent('Choose a session');
  });
});

it('orders the filter controls with a hidden search label first', async () => {
  setup();
  await fireEvent.click(button());
  const filters = grid().closest('[role="region"]')!.querySelector('.filters')!;
  expect(
    [...filters.children].map((control) =>
      control.matches('.search-field')
        ? 'Search'
        : (control.querySelector('select')?.getAttribute('aria-label') ??
          control.textContent?.trim()),
    ),
  ).toEqual(['Search', 'Harness', 'Project', 'Changed', 'Cost', 'Child sessions', 'Clear filters']);
  expect(filters.querySelector('.search-field .visually-hidden')).toHaveTextContent('Search');
});

it('ignores saved filters on arrival and writes only sort and child sessions', async () => {
  const sort = { key: 'title', direction: 'asc' };
  const stored = {
    version: 1,
    sort,
    includeChildren: true,
    search: 'absent',
    harness: 'codex',
    project: 'project',
    changed: 'today',
    cost: 'over20',
  };
  const storage = { getItem: vi.fn(() => JSON.stringify(stored)), setItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  try {
    setup();
    expect(button()).toHaveAttribute('data-session-id', 'pi-one');
    expect(button()).not.toHaveAccessibleName(/filter/);
    await fireEvent.click(button());
    expect(search()).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Harness' })).toHaveValue('all');
    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Changed' })).toHaveValue('any');
    expect(screen.getByRole('combobox', { name: 'Cost' })).toHaveValue('any');
    expect(screen.getByRole('checkbox', { name: 'Child sessions' })).toBeChecked();
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(
      screen.queryByText('The open session is hidden by these filters.'),
    ).not.toBeInTheDocument();
    await fireEvent.input(search(), { target: { value: 'absent' } });
    expect(screen.getByText('The open session is hidden by these filters.')).toBeVisible();
    expect(storage.setItem).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Child sessions' }));
    const calls = storage.setItem.mock.calls;
    expect(JSON.parse(calls[calls.length - 1][1])).toEqual({
      version: 1,
      sort,
      includeChildren: false,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
