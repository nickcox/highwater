<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import SessionView from '../components/SessionView.svelte';
  import { createAnalysisController, type AnalysisLoader } from './analysis-controller';
  import {
    defaultPresentationPreferences,
    readPresentationPreferences,
    writePresentationPreferences,
    type PresentationPreferences,
  } from '../state/presentation-preferences';
  import type { SectionId } from '../state/session-sections';

  let {
    loadAnalysis,
    preferencesKey,
    sections,
    defaultVerticalScale = 'session',
  }: {
    loadAnalysis: AnalysisLoader;
    preferencesKey: string;
    sections?: readonly SectionId[];
    defaultVerticalScale?: 'session' | 'visible';
  } = $props();
  // The loader and storage namespace belong to this mount and do not change during its lifetime.
  const controller = createAnalysisController((signal, etag) =>
    untrack(() => loadAnalysis(signal, etag)),
  );
  let presentation = $state.raw<PresentationPreferences>(
    untrack(() => {
      const base = defaultPresentationPreferences();
      base.river.verticalScale = defaultVerticalScale;
      return readPresentationPreferences(undefined, preferencesKey, base);
    }),
  );
  let following = $state(true);
  let previousRevision = 0;
  let followRequest = 0;
  let view = $state<{ followLatest(): void }>();
  let disposed = false;

  function savePreferences(next: PresentationPreferences): void {
    writePresentationPreferences(next, undefined, preferencesKey);
  }
  function pin(): void {
    following = false;
    followRequest += 1;
  }
  function followLatest(): void {
    following = true;
    view?.followLatest();
  }
  $effect(() => {
    const revision = $controller.revision;
    if (revision === previousRevision) return;
    previousRevision = revision;
    if ($controller.kind === 'selection') following = true;
    if (following) {
      const request = ++followRequest;
      // Reconcile the accepted analysis before issuing a navigation command for its latest call.
      void tick().then(() => {
        if (!disposed && following && request === followRequest) view?.followLatest();
      });
    }
  });
  onMount(() => {
    void controller.refresh();
    return () => {
      disposed = true;
      controller.dispose();
    };
  });
  export function refresh(): void {
    void controller.refresh();
  }
</script>

<div class="embedded-session">
  <header>
    <button
      type="button"
      class="follow"
      aria-pressed={following}
      title={following
        ? 'Following new calls. Select to stop following.'
        : 'Select to follow new calls.'}
      onclick={() => (following ? pin() : followLatest())}>Follow latest</button
    >
    <span role="status"
      >{$controller.loading ? 'Updating…' : $controller.error ? 'Update failed' : 'Live'}</span
    >
    {#if $controller.error}<button type="button" onclick={() => controller.refresh()}>Retry</button
      >{/if}
  </header>
  {#if $controller.error}
    <p role="alert">
      {$controller.error}{#if $controller.indexed}
        Showing the previous analysis.{/if}
    </p>
  {/if}
  {#if $controller.indexed}
    <SessionView
      bind:this={view}
      indexed={$controller.indexed}
      bind:presentation
      keyboardScope="root"
      onPreferencesChange={savePreferences}
      onPin={pin}
      {sections}
      {following}
    />
  {:else if $controller.loading}
    <p>Analysing session…</p>
  {/if}
</div>

<style>
  .embedded-session {
    min-width: 0;
    padding: 12px;
  }
  header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .follow[aria-pressed='true'] {
    border-color: var(--accent);
    background-color: var(--action);
    color: var(--active-text);
  }
  header span {
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  p[role='alert'] {
    color: var(--error);
  }
</style>
