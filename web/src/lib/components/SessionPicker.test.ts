import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SessionPicker from './SessionPicker.svelte';
import type { SessionListItem } from '../api/client';

const sessions: SessionListItem[] = [
  {
    id: 'pi-one',
    harness: 'pi',
    displayName: 'Pi task',
    fileName: 'one.jsonl',
    workingDirectory: '/project',
    startedAt: null,
    modifiedAt: null,
    byteSize: 10,
  },
  {
    id: 'opencode-two',
    harness: 'opencode',
    displayName: 'OpenCode task',
    fileName: '',
    workingDirectory: '/other',
    startedAt: null,
    modifiedAt: null,
    byteSize: null,
    parentReference: 'opencode-parent',
  },
  {
    id: 'claude-code-three',
    harness: 'claude-code',
    displayName: 'Configure the status line',
    fileName: 'agent-a16.jsonl',
    workingDirectory: '/claude',
    startedAt: null,
    modifiedAt: null,
    byteSize: 20,
    parentReference: 'claude-code-parent',
    subagentType: 'statusline-setup',
  },
];

afterEach(cleanup);

const picker = () => screen.getByRole('combobox', { name: 'Session' });
const offered = () => {
  const list = screen.queryByRole('listbox', { name: 'Sessions' });
  return list
    ? within(list)
        .queryAllByRole('option')
        .map((option) => option.textContent?.trim())
    : [];
};

describe('Harness session picker', () => {
  it('defaults to all harnesses and labels mixed results and child sessions', async () => {
    render(SessionPicker, { props: { sessions, selectedId: 'pi-one', onSelect: vi.fn() } });
    expect(screen.getByRole('combobox', { name: 'Harness' })).toHaveValue('all');
    expect(picker()).toHaveValue('[Pi] Pi task');
    expect(picker()).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(picker());
    expect(picker()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: '[Pi] Pi task' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('option', { name: '[OpenCode] OpenCode task · child session' }),
    ).toBeInTheDocument();
  });

  it('labels Claude Code subagents with their type and filters to Claude Code', async () => {
    render(SessionPicker, { props: { sessions, selectedId: 'pi-one', onSelect: vi.fn() } });
    await fireEvent.click(picker());
    expect(
      screen.getByRole('option', {
        name: '[Claude Code] Configure the status line · child session · statusline-setup',
      }),
    ).toBeInTheDocument();
    await fireEvent.change(screen.getByRole('combobox', { name: 'Harness' }), {
      target: { value: 'claude-code' },
    });
    await fireEvent.click(picker());
    expect(offered()).toEqual(['Configure the status line · child session · statusline-setup']);
  });

  it('labels VS Code Copilot sessions and filters to them', async () => {
    const withCopilot: SessionListItem[] = [
      ...sessions,
      {
        id: 'vscode-copilot-four',
        harness: 'vscode-copilot',
        displayName: 'Fix the failing parser test',
        fileName: 'four.jsonl',
        workingDirectory: '/copilot',
        startedAt: null,
        modifiedAt: null,
        byteSize: 30,
      },
    ];
    render(SessionPicker, {
      props: { sessions: withCopilot, selectedId: 'pi-one', onSelect: vi.fn() },
    });
    await fireEvent.click(picker());
    expect(
      screen.getByRole('option', { name: '[VS Code Copilot] Fix the failing parser test' }),
    ).toBeInTheDocument();
    await fireEvent.change(screen.getByRole('combobox', { name: 'Harness' }), {
      target: { value: 'vscode-copilot' },
    });
    await fireEvent.click(picker());
    expect(offered()).toEqual(['Fix the failing parser test']);
  });

  it('combines harness and search filters without changing the open session', async () => {
    const onSelect = vi.fn();
    render(SessionPicker, { props: { sessions, selectedId: 'pi-one', onSelect } });
    await fireEvent.change(screen.getByRole('combobox', { name: 'Harness' }), {
      target: { value: 'opencode' },
    });
    expect(picker()).toHaveValue('Pi task — outside filters');
    expect(picker()).toHaveAttribute('data-session-id', 'pi-one');
    await fireEvent.input(picker(), { target: { value: '/project' } });
    expect(offered()).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('No sessions match');
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.input(picker(), { target: { value: 'OpenCode' } });
    await fireEvent.click(screen.getByRole('option', { name: 'OpenCode task · child session' }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('opencode-two');
    expect(picker()).toHaveAttribute('aria-expanded', 'false');
  });

  it('searches, moves and chooses with the keyboard, and Escape closes without choosing', async () => {
    const onSelect = vi.fn();
    const outside = vi.fn();
    render(SessionPicker, { props: { sessions, selectedId: 'pi-one', onSelect } });
    document.addEventListener('keydown', outside);
    await fireEvent.keyDown(picker(), { key: 'ArrowDown' });
    expect(picker()).toHaveAttribute('aria-expanded', 'true');
    expect(picker()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: '[Pi] Pi task' }).id,
    );
    await fireEvent.keyDown(picker(), { key: 'Escape' });
    expect(picker()).toHaveAttribute('aria-expanded', 'false');
    expect(picker()).toHaveValue('[Pi] Pi task');
    expect(outside.mock.calls.some(([event]) => event.key === 'Escape')).toBe(false);
    await fireEvent.input(picker(), { target: { value: '/' } });
    await fireEvent.keyDown(picker(), { key: 'ArrowDown' });
    await fireEvent.keyDown(picker(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('opencode-two');
    document.removeEventListener('keydown', outside);
  });

  it('leaves out child sessions unless asked, then lists them under their parent', async () => {
    const family: SessionListItem[] = [
      { ...sessions[1], id: 'opencode-child', displayName: 'Explore the code' },
      { ...sessions[0], id: 'pi-other', displayName: 'Other task' },
      {
        ...sessions[1],
        id: 'opencode-parent',
        displayName: 'Parent task',
        parentReference: null,
      },
    ];
    render(SessionPicker, {
      props: { sessions: family, selectedId: 'opencode-parent', onSelect: vi.fn() },
    });
    await fireEvent.click(picker());
    expect(offered()).toEqual(['[Pi] Other task', '[OpenCode] Parent task']);

    await fireEvent.click(screen.getByRole('checkbox', { name: 'Include child sessions' }));
    await fireEvent.click(picker());
    expect(offered()).toEqual([
      '[Pi] Other task',
      '[OpenCode] Parent task',
      '[OpenCode] Explore the code · child session',
    ]);
    const child = screen.getByRole('option', { name: /Explore the code/ });
    expect(child.style.paddingInlineStart).toBe('24px');

    await fireEvent.input(picker(), { target: { value: 'explore' } });
    expect(offered()).toEqual([
      '[OpenCode] Parent task',
      '[OpenCode] Explore the code · child session',
    ]);
  });

  it('does not crash on ambiguous portable references or silently change selection', async () => {
    const onSelect = vi.fn();
    render(SessionPicker, {
      props: {
        sessions: [...sessions, { ...sessions[1], displayName: 'Duplicate' }],
        selectedId: 'pi-one',
        onSelect,
      },
    });
    expect(picker()).toHaveAttribute('data-session-id', 'pi-one');
    await fireEvent.click(picker());
    expect(
      screen
        .getAllByRole('option')
        .filter((option) => option.getAttribute('data-session-id') === 'opencode-two'),
    ).toHaveLength(1);
    await fireEvent.click(screen.getByRole('option', { name: '[Pi] Pi task' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
