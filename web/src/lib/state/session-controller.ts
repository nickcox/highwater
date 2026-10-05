import { writable, type Readable } from 'svelte/store';
import {
  ApiError,
  fetchAnalysis,
  fetchSessions,
  type LiveAvailability,
  type SessionListItem,
} from '../api/client';
import {
  connectEvents,
  type AvailabilityUpdate,
  type CatalogueInvalidation,
  type EventsClientCallbacks,
} from '../api/events';
import { AnalysisValidationError, indexAnalysis } from '../analysis';
import type { IndexedAnalysis } from '../types';

export interface SessionControllerSnapshot {
  sessions: SessionListItem[];
  selectedSessionId: string | null;
  indexed: IndexedAnalysis | null;
  loading: boolean;
  refreshing: boolean;
  sessionListError: string;
  analysisError: string;
  catalogueWarning: string;
  analysisWarning: string;
  selectedRemoved: boolean;
  liveStatus: 'live' | 'reconnecting' | 'live updates unavailable';
}

export type AnalysisAcceptance = {
  kind: 'selection' | 'replacement';
  previous: IndexedAnalysis | null;
  next: IndexedAnalysis;
};

export interface SessionSelectionChange {
  previousSessionId: string | null;
  selectedSessionId: string | null;
}

export interface SessionControllerDependencies {
  fetchSessions: typeof fetchSessions;
  fetchAnalysis: typeof fetchAnalysis;
  connectEvents: (callbacks: EventsClientCallbacks) => () => void;
  indexAnalysis: typeof indexAnalysis;
}

export interface SessionController extends Readable<SessionControllerSnapshot> {
  start(): void;
  dispose(): void;
  select(sessionId: string): void;
  retry(): void;
}

interface SelectedAnalysisRequest {
  controller: AbortController;
  sessionId: string;
  generation: string | null;
}

const DEFAULT_DEPENDENCIES: SessionControllerDependencies = {
  fetchSessions,
  fetchAnalysis,
  connectEvents,
  indexAnalysis,
};

const INITIAL_SNAPSHOT: SessionControllerSnapshot = {
  sessions: [],
  selectedSessionId: null,
  indexed: null,
  loading: true,
  refreshing: false,
  sessionListError: '',
  analysisError: '',
  catalogueWarning: '',
  analysisWarning: '',
  selectedRemoved: false,
  liveStatus: 'reconnecting',
};

export function createSessionController(
  options: {
    dependencies?: Partial<SessionControllerDependencies>;
    onAnalysisAccepted?: (acceptance: AnalysisAcceptance) => void;
    onSelectionChanged?: (change: SessionSelectionChange) => void;
  } = {},
): SessionController {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies };
  const state = writable(INITIAL_SNAPSHOT);
  let snapshot = INITIAL_SNAPSHOT;
  let lifecycle: 'new' | 'started' | 'disposed' = 'new';
  const isDisposed = () => lifecycle === 'disposed';
  let catalogueGeneration: string | null = null;
  let appliedRevision: bigint | null = null;
  let latestObservedRevision: bigint | null = null;
  let listEtag: string | null = null;
  let listInitialized = false;
  let listRequest: { controller: AbortController } | null = null;
  let listDirty = false;
  let listForce = false;
  let listReconnect = false;
  let analysisRequest: SelectedAnalysisRequest | null = null;
  let analysisDirty = false;
  let analysisWaitingForCatalogue = false;
  let transportState: 'connecting' | 'open' | 'reconnecting' | 'closed' = 'connecting';
  let reportedAvailability: LiveAvailability | null = null;
  // Matching-generation SSE observations outrank HTTP requests started before them.
  let availabilityRevision = 0;
  let stopEvents: (() => void) | null = null;
  const indexedCache = new Map<string, { etag: string | null; indexed: IndexedAnalysis }>();
  const INDEXED_CACHE_CAPACITY = 3;

  function update(patch: Partial<SessionControllerSnapshot>): void {
    snapshot = {
      ...snapshot,
      ...patch,
      refreshing: listRequest !== null || analysisRequest !== null,
    };
    state.set(snapshot);
  }

  function updateLiveStatus(): void {
    update({
      liveStatus:
        transportState === 'open' && reportedAvailability === 'active'
          ? 'live'
          : transportState === 'connecting' || transportState === 'reconnecting'
            ? 'reconnecting'
            : 'live updates unavailable',
    });
  }

  function cacheAnalysis(
    id: string,
    value: { etag: string | null; indexed: IndexedAnalysis },
  ): void {
    indexedCache.delete(id);
    indexedCache.set(id, value);
    while (indexedCache.size > INDEXED_CACHE_CAPACITY) {
      const oldest = indexedCache.keys().next().value;
      if (oldest === undefined) break;
      indexedCache.delete(oldest);
    }
  }

  function maxRevision(left: bigint | null, right: bigint | null): bigint | null {
    if (left === null) return right;
    if (right === null) return left;
    return left > right ? left : right;
  }

  // Only the current authoritative HTTP response can adopt a generation.
  function adoptGeneration(generation: string, revision: bigint): boolean {
    if (catalogueGeneration === generation) {
      latestObservedRevision = maxRevision(latestObservedRevision, revision);
      return false;
    }
    catalogueGeneration = generation;
    reportedAvailability = null;
    updateLiveStatus();
    appliedRevision = null;
    latestObservedRevision = revision;
    listEtag = null;
    analysisRequest?.controller.abort();
    analysisRequest = null;
    analysisDirty = snapshot.selectedSessionId !== null;
    analysisWaitingForCatalogue = snapshot.selectedSessionId !== null;
    return true;
  }

  function requestAuthoritativeReconciliation(): void {
    if (lifecycle === 'disposed') return;
    if (listRequest) {
      listRequest.controller.abort();
      listDirty = true;
      listForce = true;
    }
    void reconcileSessions(true);
  }

  function handleCatalogueInvalidation(event: CatalogueInvalidation): void {
    if (lifecycle === 'disposed') return;
    if (event.generation !== catalogueGeneration) {
      requestAuthoritativeReconciliation();
      return;
    }
    latestObservedRevision = maxRevision(latestObservedRevision, event.revision);
    if (appliedRevision !== null && event.revision <= appliedRevision) return;
    void reconcileSessions();
  }

  function handleAvailabilityUpdate(event: AvailabilityUpdate): void {
    if (lifecycle === 'disposed') return;
    if (event.generation !== catalogueGeneration) {
      requestAuthoritativeReconciliation();
      return;
    }
    reportedAvailability = event.availability;
    availabilityRevision += 1;
    updateLiveStatus();
  }

  async function reconcileSessions(force = false, reconnect = false): Promise<void> {
    if (lifecycle === 'disposed') return;
    if (listRequest) {
      listDirty = true;
      listForce ||= force;
      listReconnect ||= reconnect;
      return;
    }
    const controller = new AbortController();
    const request = { controller };
    listRequest = request;
    update({});
    const requestEtag = force ? null : listEtag;
    const requestAvailabilityRevision = availabilityRevision;
    try {
      const result = await dependencies.fetchSessions(controller.signal, requestEtag);
      if (isDisposed() || controller.signal.aborted || listRequest !== request) return;
      // Serialized list ownership, cancellation and identity checks guard publication.
      const previousAppliedRevision = appliedRevision;
      const generationChanged = adoptGeneration(result.generation, result.revision);
      const revisionChanged =
        generationChanged ||
        previousAppliedRevision === null ||
        result.revision > previousAppliedRevision;
      const observedRevision = latestObservedRevision;
      if (!generationChanged && observedRevision !== null && result.revision < observedRevision) {
        listDirty = true;
        return;
      }
      if (!generationChanged && appliedRevision !== null && result.revision < appliedRevision) {
        listDirty = true;
        return;
      }

      if (result.status === 'notModified') {
        if (!listInitialized || !listEtag || result.etag !== listEtag) {
          throw new ApiError(
            'Server returned not modified without the matching catalogue',
            304,
            'INVALID_CATALOG_HEADERS',
          );
        }
      } else {
        if (!result.sessions)
          throw new ApiError(
            'Server returned an empty catalogue body',
            200,
            'INVALID_CATALOG_BODY',
          );
        update({ sessions: result.sessions });
        listInitialized = true;
      }
      if (generationChanged || availabilityRevision === requestAvailabilityRevision) {
        reportedAvailability = result.availability;
        updateLiveStatus();
      }
      listEtag = result.etag;
      appliedRevision = result.revision;
      latestObservedRevision = maxRevision(latestObservedRevision, result.revision);
      update({ sessionListError: '', catalogueWarning: '' });
      if (snapshot.sessions.length === 0) {
        if (snapshot.selectedSessionId !== null) removeSelectedSession();
        update({ loading: false });
      } else if (snapshot.selectedSessionId === null) {
        update({ loading: true });
        select(snapshot.sessions[0].id);
      } else if (!snapshot.sessions.some((session) => session.id === snapshot.selectedSessionId)) {
        removeSelectedSession();
      } else {
        update({ selectedRemoved: false });
        const wasWaitingForCatalogue = analysisWaitingForCatalogue;
        analysisWaitingForCatalogue = false;
        if (revisionChanged || reconnect || analysisDirty || wasWaitingForCatalogue) {
          requestSelectedAnalysis();
        }
      }
    } catch (error) {
      if (isDisposed() || controller.signal.aborted || listRequest !== request) return;
      const message = error instanceof Error ? error.message : String(error);
      if (!listInitialized) {
        update({ sessionListError: message, loading: false });
      } else {
        update({
          catalogueWarning: `Session list refresh failed; showing previous state. ${message}`,
        });
        if (
          analysisWaitingForCatalogue &&
          snapshot.selectedSessionId !== null &&
          snapshot.indexed === null
        ) {
          update({
            loading: false,
            analysisError: `Could not refresh the selected session because its catalogue could not be verified. ${message}`,
          });
        }
      }
    } finally {
      if (listRequest === request) {
        listRequest = null;
        if (!isDisposed()) update({});
      }
      if (!isDisposed() && listDirty) {
        const nextForce = listForce;
        const nextReconnect = listReconnect;
        listDirty = false;
        listForce = false;
        listReconnect = false;
        void reconcileSessions(nextForce, nextReconnect);
      }
    }
  }

  function resetAnalysisWait(): void {
    analysisRequest?.controller.abort();
    analysisRequest = null;
    analysisDirty = false;
    analysisWaitingForCatalogue = false;
  }

  function removeSelectedSession(): void {
    resetAnalysisWait();
    options.onSelectionChanged?.({
      previousSessionId: snapshot.selectedSessionId,
      selectedSessionId: null,
    });
    update({
      selectedSessionId: null,
      indexed: null,
      selectedRemoved: true,
      analysisError: '',
      analysisWarning: '',
      loading: false,
    });
  }

  function select(sessionId: string): void {
    if (lifecycle === 'disposed') return;
    const previousSessionId = snapshot.selectedSessionId;
    resetAnalysisWait();
    if (previousSessionId !== sessionId) {
      options.onSelectionChanged?.({ previousSessionId, selectedSessionId: sessionId });
    }
    const cached = indexedCache.get(sessionId);
    if (cached) cacheAnalysis(sessionId, cached);
    update({
      selectedSessionId: sessionId,
      indexed: cached?.indexed ?? null,
      loading: cached === undefined,
      sessionListError: '',
      analysisError: '',
      analysisWarning: '',
      selectedRemoved: false,
    });
    requestSelectedAnalysis();
  }

  function requestSelectedAnalysis(): void {
    const id = snapshot.selectedSessionId;
    if (lifecycle === 'disposed' || !id) return;
    if (analysisWaitingForCatalogue) {
      analysisDirty = true;
      return;
    }
    if (analysisRequest) {
      analysisDirty = true;
      return;
    }

    const request: SelectedAnalysisRequest = {
      controller: new AbortController(),
      sessionId: id,
      generation: catalogueGeneration,
    };
    const cached = indexedCache.get(id);
    analysisRequest = request;
    analysisDirty = false;
    if (snapshot.indexed === null) update({ loading: true, analysisError: '' });
    else update({});
    void runSelectedAnalysis(request, cached);
  }

  async function runSelectedAnalysis(
    request: SelectedAnalysisRequest,
    cached: { etag: string | null; indexed: IndexedAnalysis } | undefined,
  ): Promise<void> {
    const { controller, sessionId } = request;
    const isCurrent = () =>
      lifecycle !== 'disposed' &&
      !controller.signal.aborted &&
      analysisRequest === request &&
      snapshot.selectedSessionId === sessionId &&
      catalogueGeneration === request.generation;
    try {
      const result = await dependencies.fetchAnalysis(
        sessionId,
        controller.signal,
        cached?.etag ?? null,
      );
      if (!isCurrent()) return;
      if (result.status === 'notModified') {
        if (!cached) throw new Error('Server returned not modified without a cached analysis');
        cacheAnalysis(sessionId, { ...cached, etag: result.etag ?? cached.etag });
        update({ analysisWarning: '', analysisError: '' });
      } else {
        const next = dependencies.indexAnalysis(result.analysis);
        if (!isCurrent()) return;
        const previous = snapshot.indexed;
        const kind = previous?.analysis.session.id === sessionId ? 'replacement' : 'selection';
        options.onAnalysisAccepted?.({ kind, previous, next });
        update({ indexed: next, analysisWarning: '', analysisError: '' });
        cacheAnalysis(sessionId, { etag: result.etag, indexed: next });
      }
    } catch (error) {
      if (!isCurrent()) return;
      const message =
        error instanceof AnalysisValidationError
          ? `Analysis is inconsistent: ${error.message}`
          : error instanceof ApiError && error.code === 'SESSION_SOURCE_CHANGED'
            ? 'Update not yet readable; showing previous analysis.'
            : error instanceof Error
              ? error.message
              : String(error);
      if (cached || snapshot.indexed !== null) {
        update({ analysisWarning: `Refresh failed; showing cached analysis. ${message}` });
      } else {
        update({ analysisError: message });
      }
    } finally {
      if (analysisRequest !== request) return;
      analysisRequest = null;
      if (lifecycle === 'disposed' || snapshot.selectedSessionId !== sessionId) return;
      if (analysisWaitingForCatalogue) {
        if (snapshot.indexed === null) {
          update({
            loading: false,
            analysisError:
              'Could not refresh the selected session until the session catalogue is available.',
          });
        }
        return;
      }
      if (analysisDirty) {
        analysisDirty = false;
        requestSelectedAnalysis();
        return;
      }
      update({ loading: false });
    }
  }

  function retry(): void {
    if (lifecycle === 'disposed') return;
    analysisDirty = snapshot.selectedSessionId !== null;
    void reconcileSessions(true);
  }

  function start(): void {
    if (lifecycle !== 'new') return;
    lifecycle = 'started';
    try {
      stopEvents = dependencies.connectEvents({
        onOpen: () => {
          if (lifecycle === 'disposed') return;
          transportState = 'open';
          reportedAvailability = null;
          updateLiveStatus();
          void reconcileSessions(false, true);
        },
        onReconnecting: () => {
          if (lifecycle === 'disposed') return;
          transportState = 'reconnecting';
          reportedAvailability = null;
          updateLiveStatus();
        },
        onClosed: () => {
          if (lifecycle === 'disposed') return;
          transportState = 'closed';
          reportedAvailability = null;
          updateLiveStatus();
        },
        onCatalogue: handleCatalogueInvalidation,
        onAvailability: handleAvailabilityUpdate,
        onWarning: () => {
          // Malformed advisory events never replace authoritative HTTP state.
        },
      });
    } catch {
      transportState = 'closed';
      updateLiveStatus();
    }
    void reconcileSessions(true);
  }

  function dispose(): void {
    if (lifecycle === 'disposed') return;
    lifecycle = 'disposed';
    stopEvents?.();
    stopEvents = null;
    listRequest?.controller.abort();
    listRequest = null;
    listDirty = false;
    listForce = false;
    listReconnect = false;
    analysisRequest?.controller.abort();
    analysisRequest = null;
    analysisDirty = false;
    analysisWaitingForCatalogue = false;
  }

  return {
    subscribe: state.subscribe,
    start,
    dispose,
    select,
    retry,
  };
}
