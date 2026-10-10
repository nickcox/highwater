import { get } from 'svelte/store';
import { toWireAnalysis } from '../testing/wire-analysis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisFetchResult, SessionListResult } from '../api/client';
import type { EventsClientCallbacks } from '../api/events';
import { indexAnalysis } from '../analysis';
import { testAnalysis } from '../context-river/test-data';
import { reconcileInteraction, resetInteraction } from './interaction';
import type { SessionAnalysis } from '../types';
import {
  createSessionController,
  type SessionControllerDependencies,
  type SessionControllerSnapshot,
} from './session-controller';

const generationA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const generationB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function sessionList(revision = 0n, generation = generationA, ids = ['one']): SessionListResult {
  return {
    status: 'ok',
    sessions: ids.map((id) => ({
      id,
      fileName: `${id}.jsonl`,
      displayName: id,
      workingDirectory: null,
      startedAt: null,
      byteSize: 1,
      modifiedAt: null,
    })),
    etag: `"catalog-${revision}"`,
    generation,
    revision,
    availability: 'active',
  };
}

function analysisResult(id: string, model: string): AnalysisFetchResult {
  const analysis: SessionAnalysis = testAnalysis();
  analysis.session.id = id;
  analysis.modelCalls[0].model = model;
  return { status: 'ok', analysis: toWireAnalysis(analysis), etag: `"${model}"` };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for session controller state');
}

function harness(overrides: Partial<SessionControllerDependencies> = {}) {
  let events: EventsClientCallbacks | null = null;
  const stopEvents = vi.fn();
  const dependencies: SessionControllerDependencies = {
    fetchSessions: vi.fn(async () => sessionList()),
    fetchAnalysis: vi.fn(async (id: string) => analysisResult(id, `${id}-model`)),
    connectEvents: vi.fn((callbacks: EventsClientCallbacks) => {
      events = callbacks;
      return stopEvents;
    }),
    indexAnalysis,
    ...overrides,
  };
  return {
    dependencies,
    stopEvents,
    events: () => events,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session controller', () => {
  it('loads a known linked session directly instead of briefly loading the first session', async () => {
    const h = harness({
      fetchSessions: vi.fn(async () => sessionList(0n, generationA, ['one', 'two'])),
    });
    const controller = createSessionController({
      dependencies: h.dependencies,
      initialSessionId: 'two',
    });
    controller.start();
    await waitFor(() => !get(controller).loading);
    expect(get(controller).selectedSessionId).toBe('two');
    expect(h.dependencies.fetchAnalysis).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h.dependencies.fetchAnalysis).mock.calls[0][0]).toBe('two');
    controller.dispose();
  });

  it('falls back to the first known session for an unavailable linked session', async () => {
    const h = harness();
    const controller = createSessionController({
      dependencies: h.dependencies,
      initialSessionId: 'gone',
    });
    controller.start();
    await waitFor(() => !get(controller).loading);
    expect(get(controller).selectedSessionId).toBe('one');
    controller.dispose();
  });
  it('owns initial loading and reports accepted analyses without owning interaction state', async () => {
    const h = harness();
    const accepted = vi.fn();
    const selectionChanges = vi.fn();
    const controller = createSessionController({
      dependencies: h.dependencies,
      onAnalysisAccepted: accepted,
      onSelectionChanged: selectionChanges,
    });

    controller.start();
    await waitFor(() => !get(controller).loading);

    const snapshot = get(controller);
    expect(snapshot.selectedSessionId).toBe('one');
    expect(snapshot.indexed?.analysis.modelCalls[0]?.model).toBe('one-model');
    expect(snapshot.sessionListError).toBe('');
    expect(accepted).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'selection', previous: null }),
    );
    expect(selectionChanges).toHaveBeenCalledWith({
      previousSessionId: null,
      selectedSessionId: 'one',
    });
    controller.dispose();
    expect(h.stopEvents).toHaveBeenCalledOnce();
  });

  it('coalesces invalidation during an initial load and accepts the latest analysis last', async () => {
    const initial = deferred<AnalysisFetchResult>();
    let listRequests = 0;
    let analysisRequests = 0;
    const h = harness({
      fetchSessions: vi.fn(async () => {
        listRequests += 1;
        return sessionList(listRequests === 1 ? 0n : 1n);
      }),
      fetchAnalysis: vi.fn(async (id: string) => {
        analysisRequests += 1;
        return analysisRequests === 1 ? initial.promise : analysisResult(id, 'latest-model');
      }),
    });
    const accepted = vi.fn();
    const controller = createSessionController({
      dependencies: h.dependencies,
      onAnalysisAccepted: accepted,
    });
    controller.start();
    await waitFor(() => analysisRequests === 1);

    h.events()?.onCatalogue({ generation: generationA, revision: 1n });
    await waitFor(() => listRequests === 2);
    expect(analysisRequests).toBe(1);
    initial.resolve(analysisResult('one', 'stale-model'));
    await waitFor(() => !get(controller).loading && analysisRequests === 2);

    expect(get(controller).indexed?.analysis.modelCalls[0]?.model).toBe('latest-model');
    expect(accepted.mock.calls.map(([value]) => value.kind)).toEqual(['selection', 'replacement']);
    controller.dispose();
  });

  it('invalidates old-generation authority and reloads after catalogue reconciliation', async () => {
    const initial = deferred<AnalysisFetchResult>();
    let listRequests = 0;
    let analysisRequests = 0;
    let initialSignal: AbortSignal | undefined;
    const h = harness({
      fetchSessions: vi.fn(async () => {
        listRequests += 1;
        return listRequests === 1 ? sessionList(0n, generationA) : sessionList(0n, generationB);
      }),
      fetchAnalysis: vi.fn(async (id: string, signal?: AbortSignal) => {
        analysisRequests += 1;
        if (analysisRequests === 1) {
          initialSignal = signal;
          return initial.promise;
        }
        return analysisResult(id, 'generation-b-model');
      }),
    });
    const accepted = vi.fn();
    const controller = createSessionController({
      dependencies: h.dependencies,
      onAnalysisAccepted: accepted,
    });
    controller.start();
    await waitFor(() => analysisRequests === 1);

    h.events()?.onCatalogue({ generation: generationB, revision: 0n });
    await waitFor(() => !get(controller).loading && analysisRequests === 2);
    expect(initialSignal?.aborted).toBe(true);
    initial.resolve(analysisResult('one', 'generation-a-model'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(get(controller).indexed?.analysis.modelCalls[0]?.model).toBe('generation-b-model');
    expect(accepted).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('disposes per-instance event and request work without post-disposal publication', async () => {
    const pendingAnalysis = deferred<AnalysisFetchResult>();
    let analysisSignal: AbortSignal | undefined;
    const h = harness({
      fetchAnalysis: vi.fn(async (id: string, signal?: AbortSignal) => {
        analysisSignal = signal;
        return pendingAnalysis.promise.then(() => analysisResult(id, 'late-model'));
      }),
    });
    const controller = createSessionController({ dependencies: h.dependencies });
    const published: SessionControllerSnapshot[] = [];
    const unsubscribe = controller.subscribe((snapshot) => published.push(snapshot));
    controller.start();
    await waitFor(() => analysisSignal !== undefined);
    const publicationCount = published.length;

    controller.dispose();
    expect(h.stopEvents).toHaveBeenCalledOnce();
    expect(analysisSignal?.aborted).toBe(true);
    pendingAnalysis.resolve(analysisResult('one', 'ignored'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(published).toHaveLength(publicationCount);
    expect(get(controller).indexed).toBeNull();
    expect(h.dependencies.fetchAnalysis).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('retries a failed initial analysis through an authoritative catalogue check', async () => {
    let analysisRequests = 0;
    const h = harness({
      fetchAnalysis: vi.fn(async (id: string) => {
        analysisRequests += 1;
        if (analysisRequests === 1) throw new Error('temporary analysis failure');
        return analysisResult(id, 'recovered-model');
      }),
    });
    const controller = createSessionController({ dependencies: h.dependencies });
    controller.start();
    await waitFor(() => !get(controller).loading);
    expect(get(controller).analysisError).toBe('temporary analysis failure');

    controller.retry();
    await waitFor(() => !get(controller).loading && analysisRequests === 2);
    expect(get(controller).analysisError).toBe('');
    expect(get(controller).indexed?.analysis.modelCalls[0]?.model).toBe('recovered-model');
    controller.dispose();
  });

  it.each(['removed', 'moved', 'surviving'] as const)(
    'reconciles interaction created during cached revalidation: %s source',
    async (identity) => {
      const pending = deferred<AnalysisFetchResult>();
      let requests = 0;
      const h = harness({
        fetchSessions: vi.fn(async () => sessionList(0n, generationA, ['one', 'two'])),
        fetchAnalysis: vi.fn(async (id: string) => {
          requests += 1;
          return requests === 3 ? pending.promise : analysisResult(id, id);
        }),
      });
      let interaction = resetInteraction();
      const accepted = vi.fn(({ kind, previous, next }) => {
        if (kind === 'replacement' && previous) {
          interaction = reconcileInteraction(interaction, previous, next);
        }
      });
      const controller = createSessionController({
        dependencies: h.dependencies,
        onSelectionChanged: () => {
          interaction = resetInteraction();
        },
        onAnalysisAccepted: accepted,
      });
      controller.start();
      await waitFor(() => !get(controller).loading);
      controller.select('two');
      await waitFor(() => !get(controller).loading);
      controller.select('one');
      expect(get(controller).indexed?.analysis.session.id).toBe('one');
      interaction = { ...interaction, pinnedCallIndex: 1, selectedItemId: 'a' };
      const result = analysisResult('one', 'updated');
      if (result.status !== 'ok') throw new Error('Expected analysis');
      if (identity === 'removed') result.analysis.modelCalls[0].sourceRecordId = 'new-call';
      if (identity === 'moved') {
        result.analysis.modelCalls[0].sourceRecordId = 'call2';
        result.analysis.modelCalls[1].sourceRecordId = 'call1';
      }
      pending.resolve(result);
      await waitFor(() => accepted.mock.calls.length === 3);
      expect(accepted.mock.calls[2][0].kind).toBe('replacement');
      expect(interaction.pinnedCallIndex).toBe(
        identity === 'removed' ? null : identity === 'moved' ? 2 : 1,
      );
      expect(interaction.selectedItemId).toBe('a');
      controller.dispose();
    },
  );

  it('does not reconcile unchanged cached analysis on a 304', async () => {
    let requests = 0;
    const h = harness({
      fetchAnalysis: vi.fn(async (id: string) => {
        requests += 1;
        return requests === 1
          ? analysisResult(id, 'initial')
          : { status: 'notModified' as const, etag: '"initial"' };
      }),
    });
    const accepted = vi.fn();
    const controller = createSessionController({
      dependencies: h.dependencies,
      onAnalysisAccepted: accepted,
    });
    controller.start();
    await waitFor(() => !get(controller).loading);
    const previous = get(controller).indexed;
    controller.retry();
    await waitFor(() => requests === 2);
    expect(get(controller).indexed).toBe(previous);
    expect(accepted).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it.each(['active', 'degraded'] as const)(
    'adopts restart HTTP availability: %s',
    async (availability) => {
      const pending = deferred<SessionListResult>();
      let requests = 0;
      const h = harness({
        fetchSessions: vi.fn(async () => (++requests === 1 ? sessionList() : pending.promise)),
      });
      const controller = createSessionController({ dependencies: h.dependencies });
      controller.start();
      await waitFor(() => !get(controller).loading);
      h.events()?.onOpen();
      h.events()?.onCatalogue({ generation: generationB, revision: 0n });
      h.events()?.onAvailability({ generation: generationB, availability });
      pending.resolve({ ...sessionList(0n, generationB), availability });
      await waitFor(() => requests >= 3 && !get(controller).refreshing);
      expect(get(controller).liveStatus).toBe(
        availability === 'active' ? 'live' : 'live updates unavailable',
      );
      controller.dispose();
    },
  );

  it.each(['active', 'degraded'] as const)(
    'keeps newer matching SSE status over older HTTP: %s',
    async (availability) => {
      const pending = deferred<SessionListResult>();
      let requests = 0;
      const h = harness({
        fetchSessions: vi.fn(async () => (++requests === 1 ? sessionList() : pending.promise)),
      });
      const controller = createSessionController({ dependencies: h.dependencies });
      controller.start();
      await waitFor(() => !get(controller).loading);
      h.events()?.onOpen();
      h.events()?.onAvailability({ generation: generationA, availability });
      pending.resolve({
        ...sessionList(),
        availability: availability === 'active' ? 'degraded' : 'active',
      });
      await waitFor(() => requests === 2);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(get(controller).liveStatus).toBe(
        availability === 'active' ? 'live' : 'live updates unavailable',
      );
      controller.dispose();
    },
  );

  it('uses HTTP status without SSE but never makes a closed stream live', async () => {
    const h = harness();
    const controller = createSessionController({ dependencies: h.dependencies });
    controller.start();
    await waitFor(() => !get(controller).loading);
    h.events()?.onOpen();
    await waitFor(() => get(controller).liveStatus === 'live');
    h.events()?.onClosed();
    controller.retry();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(get(controller).liveStatus).toBe('live updates unavailable');
    controller.dispose();
  });

  it('ignores old-generation status after HTTP adoption and keeps status truthful on failure', async () => {
    let generation = generationA;
    let fail = false;
    const h = harness({
      fetchSessions: vi.fn(async () => {
        if (fail) throw new Error('catalogue unavailable');
        return sessionList(0n, generation);
      }),
    });
    const controller = createSessionController({ dependencies: h.dependencies });
    controller.start();
    await waitFor(() => !get(controller).loading);
    generation = generationB;
    h.events()?.onOpen();
    await waitFor(
      () =>
        get(controller).liveStatus === 'live' &&
        vi.mocked(h.dependencies.fetchSessions).mock.calls.length === 2,
    );
    fail = true;
    h.events()?.onAvailability({ generation: generationA, availability: 'degraded' });
    await waitFor(() => get(controller).catalogueWarning !== '');
    expect(get(controller).liveStatus).toBe('live');
    h.events()?.onReconnecting();
    expect(get(controller).liveStatus).toBe('reconnecting');
    controller.dispose();
    const snapshot = get(controller);
    h.events()?.onAvailability({ generation: generationB, availability: 'active' });
    expect(get(controller)).toBe(snapshot);
  });

  it('keeps controller instances isolated', async () => {
    const first = harness({
      fetchSessions: vi.fn(async () => sessionList(0n, generationA, ['one'])),
    });
    const second = harness({
      fetchSessions: vi.fn(async () => sessionList(0n, generationB, ['two'])),
    });
    const firstController = createSessionController({ dependencies: first.dependencies });
    const secondController = createSessionController({ dependencies: second.dependencies });
    firstController.start();
    secondController.start();
    await waitFor(() => !get(firstController).loading && !get(secondController).loading);

    expect(get(firstController).selectedSessionId).toBe('one');
    expect(get(secondController).selectedSessionId).toBe('two');
    firstController.dispose();
    expect(get(secondController).indexed?.analysis.session.id).toBe('two');
    secondController.dispose();
  });
});
