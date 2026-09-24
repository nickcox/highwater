import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyButton from './CopyButton.svelte';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('CopyButton', () => {
  it('copies the value and announces success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(CopyButton, { props: { value: 'opaque-record-id', label: 'source record ID' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Copy source record ID' }));

    expect(writeText).toHaveBeenCalledWith('opaque-record-id');
    expect(screen.getByRole('status')).toHaveTextContent('Source record ID copied.');
  });

  it('explains clipboard unavailability and rejected copy attempts', async () => {
    render(CopyButton, { props: { value: 'opaque-id', label: 'context ID' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Copy context ID' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Clipboard is unavailable/);
    expect(screen.getByRole('status')).toHaveTextContent(/copy it manually/i);

    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Copy context ID' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Could not copy context ID/);
    expect(screen.getByRole('status')).toHaveTextContent(/copy it manually/i);
  });
});
