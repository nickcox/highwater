<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ItemContentLoader } from '../api/client';
  import type { ContextItemPreview } from '../types';

  let {
    preview,
    itemId,
    sessionId,
    loadItemContent,
    legacyExpanded,
    onToggleLegacy,
  }: {
    preview: ContextItemPreview | null;
    itemId: string;
    sessionId: string;
    loadItemContent?: ItemContentLoader;
    legacyExpanded: boolean;
    onToggleLegacy: () => void;
  } = $props();

  let legacyText = $derived(preview?.expandedText);
  let legacyHasMore = $derived(
    legacyText !== undefined && (legacyText !== preview?.text || preview?.expandedTruncated),
  );
  let canFetch = $derived(
    !!loadItemContent &&
      legacyText === undefined &&
      !!preview?.truncated &&
      preview.kind !== 'unavailable',
  );
  let expanded = $state(false);
  let text = $state<string | null>(null);
  let nextCursor = $state<string | null>(null);
  let request = $state.raw<AbortController | null>(null);
  let error = $state('');

  function collapse(): void {
    request?.abort();
    request = null;
    text = null;
    nextCursor = null;
    error = '';
    expanded = false;
  }

  async function load(): Promise<void> {
    if (!loadItemContent || request) return;
    expanded = true;
    error = '';
    const current = new AbortController();
    request = current;
    try {
      const page = await loadItemContent(sessionId, itemId, nextCursor, current.signal);
      if (current.signal.aborted) return;
      text = (text ?? '') + page.text;
      nextCursor = page.nextCursor;
    } catch (failure) {
      if (!current.signal.aborted) {
        error = failure instanceof Error ? failure.message : 'Could not load item content.';
      }
    } finally {
      if (request === current) request = null;
    }
  }

  onDestroy(() => request?.abort());
</script>

<div class="preview-details">
  {#if expanded && text !== null}
    <pre>{text}</pre>
  {:else if legacyHasMore && legacyExpanded}
    <pre>{legacyText}</pre>
    {#if preview?.expandedTruncated}
      <p class="preview-note">Expanded preview truncated.</p>
    {/if}
  {:else if preview?.text}
    <p class="content-preview"><b>Content preview</b> {preview.text}</p>
  {:else}
    <p class="preview-note">No content preview is available.</p>
  {/if}

  {#if request}
    <p class="preview-note" role="status">Loading content…</p>
  {:else if error}
    <p class="preview-note" role="alert">{error}</p>
    <button type="button" class="preview-toggle" onclick={load}>Retry</button>
  {/if}
  {#if expanded && nextCursor !== null && !error}
    <button type="button" class="preview-toggle" disabled={!!request} onclick={load}
      >Load more</button
    >
  {/if}

  {#if canFetch || expanded}
    <button
      type="button"
      class="preview-toggle"
      aria-expanded={expanded}
      onclick={() => (expanded ? collapse() : load())}
      >{expanded ? 'Show less' : 'Show more'}</button
    >
  {:else if legacyHasMore}
    <button
      type="button"
      class="preview-toggle"
      aria-expanded={legacyExpanded}
      onclick={onToggleLegacy}>{legacyExpanded ? 'Show less' : 'Show more'}</button
    >
  {/if}
</div>

<style>
  .content-preview {
    color: var(--text);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .preview-note {
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  .preview-toggle {
    display: block;
    width: fit-content;
    margin: 7px 0 0 auto;
    min-height: 28px;
    padding: 4px 8px;
    font-size: var(--text-xs);
    color: var(--secondary);
    background: transparent;
    border: 1px solid transparent;
  }
  .preview-toggle:hover {
    text-decoration: underline;
    background: var(--plot);
  }
  pre {
    color: var(--text);
    background: var(--plot);
    border-radius: var(--control-radius);
    margin: 7px 0 0;
    padding: 8px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
  }
</style>
