import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
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

describe('Harness session picker', () => {
  it('defaults to all harnesses and labels mixed results and child sessions', () => {
    render(SessionPicker, { props: { sessions, selectedId: 'pi-one', onSelect: vi.fn() } });
    expect(screen.getByRole('combobox', { name: 'Harness' })).toHaveValue('all');
    expect(screen.getByRole('option', { name: '[Pi] Pi task' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: '[OpenCode] OpenCode task · child session' }),
    ).toBeInTheDocument();
  });

  it('labels Claude Code subagents with their type and filters to Claude Code', async () => {
    render(SessionPicker, { props: { sessions, selectedId: 'pi-one', onSelect: vi.fn() } });
    expect(
      screen.getByRole('option', {
        name: '[Claude Code] Configure the status line · child session · statusline-setup',
      }),
    ).toBeInTheDocument();
    await fireEvent.change(screen.getByRole('combobox', { name: 'Harness' }), {
      target: { value: 'claude-code' },
    });
    expect(
      screen.getByRole('option', {
        name: 'Configure the status line · child session · statusline-setup',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /OpenCode task/ })).not.toBeInTheDocument();
  });

  it('combines harness and search filters without changing the open session', async () => {
    const onSelect = vi.fn();
    render(SessionPicker, { props: { sessions, selectedId: 'pi-one', onSelect } });
    await fireEvent.change(screen.getByRole('combobox', { name: 'Harness' }), {
      target: { value: 'opencode' },
    });
    const picker = screen.getByRole('combobox', { name: 'Session' });
    expect(picker).toHaveValue('pi-one');
    expect(screen.getByRole('option', { name: 'Pi task — outside filters' })).toBeDisabled();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search sessions' }), {
      target: { value: '/project' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('No sessions match');
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search sessions' }), {
      target: { value: 'OpenCode' },
    });
    await fireEvent.change(picker, { target: { value: 'opencode-two' } });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('opencode-two');
  });

  it('does not crash on ambiguous portable references or silently change selection', () => {
    render(SessionPicker, {
      props: {
        sessions: [...sessions, { ...sessions[1], displayName: 'Duplicate' }],
        selectedId: 'pi-one',
        onSelect: vi.fn(),
      },
    });
    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('pi-one');
    expect(
      screen
        .getAllByRole('option')
        .filter((option) => (option as HTMLOptionElement).value === 'opencode-two'),
    ).toHaveLength(1);
  });
});
