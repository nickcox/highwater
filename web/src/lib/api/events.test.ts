import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectEvents, type EventSourceLike } from './events';

class FakeEventSource implements EventSourceLike {
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private listeners = new Map<string, Array<(event: Event) => void>>();

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
    );
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  emit(type: string, data: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SSE event client', () => {
  it('validates content-free catalogue and availability events', () => {
    const source = new FakeEventSource();
    const onCatalogue = vi.fn();
    const onAvailability = vi.fn();
    const stop = connectEvents(
      {
        onOpen: vi.fn(),
        onReconnecting: vi.fn(),
        onClosed: vi.fn(),
        onCatalogue,
        onAvailability,
        onWarning: vi.fn(),
      },
      () => source,
    );

    source.open();
    source.emit('sessionsChanged', {
      generation: '0123456789abcdef0123456789abcdef',
      revision: '18446744073709551615',
    });
    source.emit('liveStatus', {
      generation: '0123456789abcdef0123456789abcdef',
      availability: 'active',
    });

    expect(onCatalogue).toHaveBeenCalledWith({
      generation: '0123456789abcdef0123456789abcdef',
      revision: 18446744073709551615n,
    });
    expect(onAvailability).toHaveBeenCalledWith({
      generation: '0123456789abcdef0123456789abcdef',
      availability: 'active',
    });
    stop();
    expect(source.closed).toBe(true);
  });

  it('ignores malformed or extra event fields', () => {
    const source = new FakeEventSource();
    const warning = vi.fn();
    const onCatalogue = vi.fn();
    connectEvents(
      {
        onOpen: vi.fn(),
        onReconnecting: vi.fn(),
        onClosed: vi.fn(),
        onCatalogue,
        onAvailability: vi.fn(),
        onWarning: warning,
      },
      () => source,
    );
    source.emit('sessionsChanged', {
      generation: 'bad',
      revision: '1',
      path: '/private/session.jsonl',
    });
    expect(onCatalogue).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalled();
  });
});
