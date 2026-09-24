import { GENERATION_PATTERN, MAX_CATALOG_REVISION, type LiveAvailability } from './client';

export interface CatalogueInvalidation {
  generation: string;
  revision: bigint;
}

export interface AvailabilityUpdate {
  generation: string;
  availability: LiveAvailability;
}

export interface EventSourceLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

export interface EventsClientCallbacks {
  onOpen: () => void;
  onReconnecting: () => void;
  onClosed: () => void;
  onCatalogue: (event: CatalogueInvalidation) => void;
  onAvailability: (event: AvailabilityUpdate) => void;
  onWarning: (message: string) => void;
}

function parseObject(event: Event): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse((event as MessageEvent<string>).data);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseGeneration(value: unknown): string | null {
  return typeof value === 'string' && GENERATION_PATTERN.test(value) ? value : null;
}

function parseRevision(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  try {
    const revision = BigInt(value);
    return revision >= 0n && revision <= MAX_CATALOG_REVISION ? revision : null;
  } catch {
    return null;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).every((key) => keys.includes(key)) &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

export function connectEvents(
  callbacks: EventsClientCallbacks,
  factory: EventSourceFactory = (url) => new EventSource(url),
): () => void {
  const source = factory('/api/events');
  let closed = false;
  const onOpen = () => {
    if (closed) return;
    callbacks.onOpen();
  };
  const onError = () => {
    if (closed) return;
    if (source.readyState === 2) callbacks.onClosed();
    else callbacks.onReconnecting();
  };
  const onCatalogue = (event: Event) => {
    if (closed) return;
    const value = parseObject(event);
    if (!value || !hasOnlyKeys(value, ['generation', 'revision'])) {
      callbacks.onWarning('Ignored malformed live-update event');
      return;
    }
    const generation = parseGeneration(value.generation);
    const revision = parseRevision(value.revision);
    if (!generation || revision === null) {
      callbacks.onWarning('Ignored malformed live-update event');
      return;
    }
    callbacks.onCatalogue({ generation, revision });
  };
  const onAvailability = (event: Event) => {
    if (closed) return;
    const value = parseObject(event);
    if (!value || !hasOnlyKeys(value, ['generation', 'availability'])) {
      callbacks.onWarning('Ignored malformed live-status event');
      return;
    }
    const generation = parseGeneration(value.generation);
    const availability = value.availability;
    if (!generation || (availability !== 'active' && availability !== 'degraded')) {
      callbacks.onWarning('Ignored malformed live-status event');
      return;
    }
    callbacks.onAvailability({ generation, availability });
  };

  source.onopen = onOpen;
  source.onerror = onError;
  source.addEventListener('sessionsChanged', onCatalogue);
  source.addEventListener('liveStatus', onAvailability);

  return () => {
    if (closed) return;
    closed = true;
    source.removeEventListener('sessionsChanged', onCatalogue);
    source.removeEventListener('liveStatus', onAvailability);
    source.onopen = null;
    source.onerror = null;
    source.close();
  };
}
