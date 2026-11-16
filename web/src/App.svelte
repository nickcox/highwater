<script lang="ts">
  import { onMount, onDestroy, tick, untrack } from 'svelte';
  import ThemeSelector from './lib/components/ThemeSelector.svelte';
  import SessionView from './lib/components/SessionView.svelte';
  import SessionPicker from './lib/components/SessionPicker.svelte';
  import { themeController } from './lib/theme/controller';
  import {
    readPresentationPreferences,
    writePresentationPreferences,
    type PresentationPreferences,
  } from './lib/state/presentation-preferences';
  import { sessionDetailLine } from './lib/session-label';
  import {
    createSessionController,
    type SessionControllerSnapshot,
  } from './lib/state/session-controller';
  import type { SessionViewSnapshot } from './lib/state/session-view';
  import {
    parseViewLink,
    isViewLinkFragment,
    serializeViewLink,
    validateViewLink,
    viewLinkSignature,
    type ViewLinkState,
  } from './lib/state/view-link';
  onDestroy(themeController.start());
  const storedPresentation = readPresentationPreferences();
  let appRoot = $state<HTMLElement>();
  let viewComponent = $state<{ restoreView(state: ViewLinkState): boolean }>();
  let viewState = $state.raw<SessionViewSnapshot | null>(null);
  let riverSessionId = $state<string | null>(null);
  const initialLink = parseViewLink(
    typeof window === 'undefined' ? '' : window.location.hash,
    storedPresentation.river.display,
  );
  // Resolve grouping before the first geometry build; URL state wins over storage.
  let presentation = $state.raw<PresentationPreferences>({
    ...storedPresentation,
    river: {
      ...storedPresentation.river,
      display: initialLink.state?.display ?? storedPresentation.river.display,
    },
  });
  let pendingViewLink = $state.raw<ViewLinkState | null>(initialLink.state);
  let viewLinkNotice = $state(initialLink.notice);
  let copyLinkNotice = $state('');
  let fallbackViewUrl = $state('');
  let fallbackLinkInput = $state<HTMLInputElement>();
  let urlMounted = $state(false);
  let lastReadHash = typeof window === 'undefined' ? '' : window.location.hash;
  let lastUrlSignature = '';
  let replaceNextUrl = false;
  let rangeUrlTimer: number | null = null;
  let scheduledRangeUrl: { hash: string; signature: string } | null = null;
  let viewRestoreQueued = false;
  let restoringView = false;

  const sessionController = createSessionController({
    initialSessionId: initialLink.state?.session,
    onAnalysisAccepted: ({ previous, next }) => {
      if (previous?.analysis.session.id === next.analysis.session.id) replaceNextUrl = true;
    },
    onSelectionChanged: () => {
      viewState = null;
    },
  });
  let indexed = $derived($sessionController.indexed);
  let selectedSessionListing = $derived(
    $sessionController.sessions.find(
      (session) => session.id === $sessionController.selectedSessionId,
    ),
  );
  let selectedSessionDetail = $derived(
    selectedSessionListing ? sessionDetailLine(selectedSessionListing) : '',
  );
  let linkedView = $derived(viewState?.linkedView ?? null);
  let linkedSignature = $derived(
    linkedView ? viewLinkSignature(linkedView, viewState?.navigationRevision ?? 0) : '',
  );
  $effect.pre(() => {
    void viewState?.riverReady;
    if (urlMounted && pendingViewLink && !$sessionController.loading) untrack(queueViewRestore);
  });
  $effect.pre(() => {
    if (
      urlMounted &&
      linkedView &&
      indexed &&
      !pendingViewLink &&
      !$sessionController.loading &&
      viewState?.settled
    ) {
      const view = linkedView;
      const signature = linkedSignature;
      untrack(() => syncViewUrl(view, signature));
    }
  });
  onMount(() => {
    urlMounted = true;
    window.addEventListener('popstate', readViewUrl);
    window.addEventListener('hashchange', readViewUrl);
    sessionController.start();
    return () => {
      urlMounted = false;
      cancelRangeUrl();
      window.removeEventListener('popstate', readViewUrl);
      window.removeEventListener('hashchange', readViewUrl);
      sessionController.dispose();
    };
  });

  function readViewUrl(): void {
    if (lastReadHash === window.location.hash) return;
    lastReadHash = window.location.hash;
    cancelRangeUrl();
    const storedDisplay = readPresentationPreferences().river.display;
    const parsed = parseViewLink(lastReadHash, storedDisplay);
    if (lastReadHash && !isViewLinkFragment(lastReadHash)) return;
    viewLinkNotice = parsed.notice;
    copyLinkNotice = '';
    fallbackViewUrl = '';
    pendingViewLink =
      parsed.state ??
      ($sessionController.selectedSessionId
        ? {
            session: $sessionController.selectedSessionId,
            view: 'river',
            display: storedDisplay,
            scope: 'cumulative',
            range: null,
            pin: null,
            item: null,
          }
        : null);
    if (
      pendingViewLink &&
      $sessionController.sessions.some((session) => session.id === pendingViewLink!.session) &&
      pendingViewLink.session !== $sessionController.selectedSessionId
    )
      sessionController.select(pendingViewLink.session);
  }

  function queueViewRestore(): void {
    if (viewRestoreQueued || restoringView) return;
    viewRestoreQueued = true;
    // Apply outside the reactive derivation pass so inspector projections also
    // observe the restored selection/pin, not only raw child props.
    queueMicrotask(() => {
      viewRestoreQueued = false;
      if (urlMounted && !$sessionController.loading) restoreLinkedView($sessionController);
    });
  }

  function restoreLinkedView(snapshot: SessionControllerSnapshot): void {
    if (!pendingViewLink) return;
    let requested = pendingViewLink;
    if (!snapshot.sessions.some((session) => session.id === requested.session)) {
      viewLinkNotice =
        'The session in this view link is not available here. Showing the default view; choose a session or refresh after making it available.';
      if (!snapshot.selectedSessionId) {
        pendingViewLink = null;
        return;
      }
      requested = {
        session: snapshot.selectedSessionId,
        view: 'river',
        display: readPresentationPreferences().river.display,
        scope: 'cumulative',
        range: null,
        pin: null,
        item: null,
      };
    }
    if (snapshot.selectedSessionId !== requested.session || !snapshot.indexed) return;
    // Waits for the River to mount, so the linked range is applied at the River's size.
    if (!viewState?.riverReady) return;
    const validated = validateViewLink(requested, snapshot.indexed);
    if (validated.notice)
      viewLinkNotice = [viewLinkNotice, validated.notice].filter(Boolean).join(' ');
    const state = validated.state;
    if (!viewComponent?.restoreView(state)) return;
    const request = pendingViewLink;
    restoringView = true;
    lastUrlSignature = viewLinkSignature(state, viewState?.navigationRevision ?? 0);
    // The view publishes its restored state during the next Svelte update. Keep URL writes
    // paused until then, so Back/Forward cannot push the previous view into history.
    void tick().then(() => {
      if (pendingViewLink === request) pendingViewLink = null;
      restoringView = false;
    });
  }

  function cancelRangeUrl(): void {
    if (rangeUrlTimer !== null) window.clearTimeout(rangeUrlTimer);
    rangeUrlTimer = null;
    scheduledRangeUrl = null;
  }

  function commitViewUrl(hash: string, signature: string, push: boolean): void {
    try {
      window.history[push ? 'pushState' : 'replaceState'](window.history.state, '', hash);
      lastReadHash = hash;
      lastUrlSignature = signature;
      replaceNextUrl = false;
    } catch {
      viewLinkNotice =
        'The browser could not update the view URL. Copy view link is still available.';
    }
  }

  function syncViewUrl(state: ViewLinkState, signature: string): void {
    const hash = serializeViewLink(state);
    if (hash === window.location.hash && signature === lastUrlSignature) {
      cancelRangeUrl();
      replaceNextUrl = false;
      return;
    }
    const push =
      !replaceNextUrl &&
      lastUrlSignature !== '' &&
      signature !== lastUrlSignature &&
      hash !== window.location.hash;
    // Debounce continuous range movement, avoiding browser history API rate limits.
    // Copy uses the current measured state, even while this address update is queued.
    if (!replaceNextUrl && lastUrlSignature !== '' && signature === lastUrlSignature) {
      if (scheduledRangeUrl?.hash === hash) return;
      cancelRangeUrl();
      scheduledRangeUrl = { hash, signature };
      rangeUrlTimer = window.setTimeout(() => {
        const scheduled = scheduledRangeUrl;
        cancelRangeUrl();
        if (urlMounted && scheduled) commitViewUrl(scheduled.hash, scheduled.signature, false);
      }, 400);
      return;
    }
    const previous = scheduledRangeUrl;
    cancelRangeUrl();
    if (push && previous) commitViewUrl(previous.hash, previous.signature, false);
    commitViewUrl(hash, signature, push);
  }

  async function copyViewLink(): Promise<void> {
    if (!linkedView || pendingViewLink) return;
    const url = new URL(window.location.href);
    // Query parameters are not app navigation; never copy URL credentials/tokens.
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = serializeViewLink(linkedView);
    cancelRangeUrl();
    commitViewUrl(url.hash, linkedSignature, false);
    try {
      await navigator.clipboard.writeText(url.href);
      copyLinkNotice = 'View link copied. Recipients need access to this session.';
      fallbackViewUrl = '';
    } catch {
      copyLinkNotice = 'Clipboard access is unavailable. Copy the view link below.';
      fallbackViewUrl = url.href;
      await tick();
      fallbackLinkInput?.focus();
      fallbackLinkInput?.select();
    }
  }

  function selectSession(sessionId: string): void {
    pendingViewLink = null;
    viewLinkNotice = '';
    copyLinkNotice = '';
    fallbackViewUrl = '';
    sessionController.select(sessionId);
  }
</script>

<main bind:this={appRoot}>
  <header class="titlebar">
    <div class="title-summary">
      <h1>
        <svg class="logo" viewBox="6 19 52 36" width="30" height="21" aria-hidden="true">
          <path d="M8 54 C20 52 30 40 56 30 L56 54 Z" fill="var(--item-type-toolResult)" />
          <path d="M8 54 C22 53 32 46 56 40 L56 54 Z" fill="var(--item-type-assistantMessage)" />
          <path d="M8 54 C24 54 36 50 56 48 L56 54 Z" fill="var(--item-type-userMessage)" />
          <path
            d="M8 22 H56"
            stroke="var(--accent)"
            stroke-opacity="0.75"
            stroke-width="2.25"
            stroke-dasharray="3.5 3.5"
            stroke-linecap="round"
          />
        </svg>
        Highwater
      </h1>
      <div class="title-status">
        <!-- Refresh sits at the end of the status line, so it does not add a row to the header. -->
        <div class="status-row">
          <p class="live-status">
            <span data-testid="live-status">Live updates: {$sessionController.liveStatus}</span
            >{#if selectedSessionDetail}<span class="session-detail" title={selectedSessionDetail}
                >{' · '}{selectedSessionDetail}</span
              >{/if}
          </p>
          {#if ($sessionController.liveStatus !== 'live' || $sessionController.sessions.length === 0) && !$sessionController.catalogueWarning && !$sessionController.analysisWarning && !$sessionController.sessionListError && !$sessionController.analysisError}
            <button type="button" class="status-refresh" onclick={() => sessionController.retry()}
              >Refresh</button
            >
          {/if}
        </div>
        {#if $sessionController.refreshing && !$sessionController.loading}
          <p role="status" aria-label="Refresh progress">Refreshing sessions…</p>
        {/if}
      </div>
    </div>
    <div class="theme-controls"><ThemeSelector /></div>
    {#if $sessionController.sessions.length > 0}
      <div class="session-controls">
        <SessionPicker
          sessions={$sessionController.sessions}
          selectedId={$sessionController.selectedSessionId}
          onSelect={selectSession}
        />
      </div>
    {/if}
  </header>

  {#if viewLinkNotice || copyLinkNotice}
    <p role="status" aria-label="View link status">{viewLinkNotice} {copyLinkNotice}</p>
  {/if}
  {#if fallbackViewUrl}
    <label class="view-link-fallback"
      >View link <input bind:this={fallbackLinkInput} readonly value={fallbackViewUrl} /></label
    >
  {/if}

  {#if $sessionController.catalogueWarning || $sessionController.analysisWarning}
    <section class="refresh-warning" role="status" aria-label="Refresh warnings">
      {#if $sessionController.catalogueWarning}<p>{$sessionController.catalogueWarning}</p>{/if}
      {#if $sessionController.analysisWarning}<p>{$sessionController.analysisWarning}</p>{/if}
      <button type="button" onclick={() => sessionController.retry()}>Refresh</button>
    </section>
  {/if}
  {#if $sessionController.sessionListError}
    <section class="state error">
      <h2>Could not discover sessions</h2>
      <p>{$sessionController.sessionListError}</p>
      <button type="button" onclick={() => sessionController.retry()}>Retry</button>
    </section>
  {:else if $sessionController.sessions.length === 0 && !$sessionController.loading}
    {#if $sessionController.selectedRemoved}
      <section class="state">
        <h2>Selected session is no longer available</h2>
        <p>Choose another session after one appears in the session directory.</p>
      </section>
    {:else}
      <section class="state">
        <h2>No sessions discovered</h2>
        <p>Point Highwater at a session directory with <code>--session-root</code>.</p>
      </section>
    {/if}
  {:else if $sessionController.selectedRemoved}
    <section class="state">
      <h2>Selected session is no longer available</h2>
      <p>Choose another session from the refreshed list.</p>
    </section>
  {:else if $sessionController.loading}
    <section class="state"><p>Analysing session…</p></section>
  {:else if $sessionController.analysisError}
    <section class="state error">
      <h2>Could not render this session</h2>
      <p>{$sessionController.analysisError}</p>
      <button type="button" onclick={() => sessionController.retry()}>Retry</button>
    </section>
  {:else if indexed}
    <SessionView
      bind:this={viewComponent}
      {indexed}
      sessions={$sessionController.sessions}
      sessionReference={$sessionController.selectedSessionId}
      bind:presentation
      bind:viewState
      bind:riverSessionId
      keyboardOwner={appRoot}
      onPreferencesChange={writePresentationPreferences}
      onCopyViewLink={copyViewLink}
      copyDisabled={pendingViewLink !== null || !viewState?.settled}
    />
  {/if}
</main>

<style>
  main {
    max-width: 1500px;
    min-width: 0;
    margin: 0 auto;
    padding: 26px;
  }
  /* The title with the theme icons at the right, the session picker on its own row below, and
     the status line describing the chosen session under the picker. The title block's children
     are placed in the header grid directly. */
  .titlebar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'title theme'
      'picker picker'
      'status status';
    align-items: center;
    gap: 10px 24px;
    min-width: 0;
  }
  .title-summary {
    display: contents;
  }
  .title-summary > h1 {
    grid-area: title;
  }
  .title-status {
    grid-area: status;
    min-width: 0;
  }
  .session-controls {
    grid-area: picker;
    width: min(960px, 100%);
  }
  .theme-controls {
    grid-area: theme;
  }
  .titlebar > * {
    min-width: 0;
    max-width: 100%;
  }
  h1 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    letter-spacing: -0.03em;
  }
  .titlebar p {
    color: var(--secondary);
    margin: 4px 0 0;
  }
  .status-row {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 720px;
    margin-top: 4px;
  }
  .titlebar .status-row > .live-status {
    flex: 0 1 auto;
    min-width: 0;
    margin: 0;
  }
  .status-refresh {
    flex: none;
    min-height: 0;
    padding: 2px 9px;
    font-size: var(--text-sm);
    line-height: 1.4;
  }
  .live-status {
    max-width: 640px;
    overflow: hidden;
    font-size: var(--text-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h2 {
    font-size: var(--text-lg);
    margin: 0;
  }
  .view-link-fallback {
    display: block;
  }
  .view-link-fallback input {
    display: block;
    box-sizing: border-box;
    width: min(100%, 64rem);
  }
  .state {
    margin-top: 24px;
    padding: 24px;
    border-radius: var(--radius);
    background: var(--plot);
    border: 1px solid var(--separator);
  }
  .state h2 {
    font-size: 18px;
  }
  .state.error {
    border-color: var(--error-border);
    color: var(--error);
  }
  .refresh-warning {
    margin-top: 14px;
    padding: 10px 14px;
    border: 1px solid var(--warning-border);
    border-radius: var(--radius);
    background: var(--warning-surface);
    color: var(--warning);
  }
  code {
    color: var(--secondary);
  }
  @container highwater (max-width: 850px) {
    main {
      padding: 16px;
    }
  }
  @container highwater (max-width: 380px) {
    .titlebar {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        'title'
        'theme'
        'picker'
        'status';
    }
    .theme-controls {
      justify-self: start;
    }
  }
</style>
