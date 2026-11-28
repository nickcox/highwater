<script lang="ts">
  import type { SessionListItem } from '../api/client';
  import {
    activeFilters,
    printableKey,
    browserEntries,
    clearFilters,
    costNote,
    projects,
    projectOf,
    tooltip,
    formatDuration,
    type SessionBrowserState,
  } from '../session-browser';
  import { formatSessionTime, harnessName } from '../session-label';
  import { formatSessionCost } from '../context-river/format';
  let {
    sessions,
    browserState = $bindable(),
    selectedId,
    onSelect,
    onClose,
    id,
  }: {
    sessions: SessionListItem[];
    browserState: SessionBrowserState;
    selectedId: string | null;
    onSelect: (s: SessionListItem) => void;
    onClose: () => void;
    id: string;
  } = $props();
  let searchInput: HTMLInputElement;
  let table: HTMLTableElement;
  let index = $state(0);
  let entries = $derived(browserEntries(sessions, browserState));
  $effect(() => {
    index = Math.max(0, Math.min(index, entries.length - 1));
  });
  $effect(() => {
    searchInput?.focus();
  });
  function sort(key: SessionBrowserState['sort']['key']) {
    browserState.sort = {
      key,
      direction:
        browserState.sort.key === key
          ? browserState.sort.direction === 'asc'
            ? 'desc'
            : 'asc'
          : ['title', 'project', 'harness'].includes(key)
            ? 'asc'
            : 'desc',
    };
  }
  function key(event: KeyboardEvent) {
    if (event.target !== table) return;
    if (event.isComposing || ['Process', 'Dead', 'Unidentified'].includes(event.key)) {
      searchInput.focus();
      event.stopPropagation();
      return;
    }
    if (printableKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      browserState.search += event.key;
      searchInput.focus();
      return;
    }
    if (event.key === 'ArrowUp' && index === 0) {
      event.preventDefault();
      event.stopPropagation();
      searchInput.focus();
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Enter') {
      if (entries[index]) onSelect(entries[index].session);
      return;
    }
    index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? entries.length - 1
          : Math.max(0, Math.min(entries.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    table.querySelectorAll('tbody tr')[index]?.scrollIntoView?.({ block: 'nearest' });
  }
  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'project', label: 'Project' },
    { key: 'harness', label: 'Harness' },
    { key: 'changed', label: 'Last changed' },
    { key: 'duration', label: 'Duration' },
    { key: 'cost', label: 'Cost' },
  ] as const;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
<div
  role="region"
  {id}
  aria-label="Session browser"
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }}
>
  {#if selectedId && !entries.some((e) => e.session.id === selectedId)}<p class="hidden-note">
      The open session is hidden by these filters. <button
        onclick={() => (browserState = clearFilters(browserState))}>Clear filters</button
      >
    </p>{/if}
  <div class="filters">
    <label class="search-field"
      ><span class="visually-hidden">Search</span>
      <input
        bind:this={searchInput}
        bind:value={browserState.search}
        aria-label="Search sessions"
        placeholder="Search title, project, prompt or ID"
        onkeydown={(event) => {
          if (event.key === 'ArrowDown' && !event.isComposing && entries.length) {
            event.preventDefault();
            event.stopPropagation();
            index = 0;
            table.focus();
            table.querySelector('tbody tr')?.scrollIntoView?.({ block: 'nearest' });
          }
        }}
      /></label
    >
    <label
      >Harness<select aria-label="Harness" bind:value={browserState.harness}>
        <option value="all">All harnesses</option><option value="pi">Pi</option><option
          value="opencode">OpenCode</option
        ><option value="claude-code">Claude Code</option><option value="codex">Codex</option><option
          value="copilot">Copilot app and CLI</option
        ><option value="vscode-copilot">VS Code Copilot</option>
      </select></label
    >
    <label
      >Project<select aria-label="Project" bind:value={browserState.project}
        ><option value={null}>All projects</option>{#each projects(sessions) as p}<option
            value={p.project}>{p.project} ({p.count})</option
          >{/each}</select
      ></label
    >
    <label
      >Changed<select aria-label="Changed" bind:value={browserState.changed}
        ><option value="any">Any time</option><option value="today">Today</option
        >{#each [7, 30, 90] as days}<option value={`${days}d`}>Last {days} days</option
          >{/each}</select
      ></label
    >
    <label
      >Cost<select aria-label="Cost" bind:value={browserState.cost}
        ><option value="any">Any cost</option>{#each [1, 5, 20] as amount}<option
            value={`over${amount}`}>Over ${amount}</option
          >{/each}<option value="unknown">Cost unknown</option></select
      ></label
    >
    <label class="include-children"
      ><input type="checkbox" bind:checked={browserState.includeChildren} />Child sessions</label
    >
    <button
      disabled={!activeFilters(browserState)}
      onclick={() => (browserState = clearFilters(browserState))}>Clear filters</button
    >
  </div>
  <div class="scroll">
    <table
      role="grid"
      bind:this={table}
      tabindex="0"
      onkeydown={key}
      aria-label="Sessions"
      oncompositionstart={() => searchInput.focus()}
      oncompositionend={(event) => {
        if (event.target === table) browserState.search += event.data;
      }}
      aria-activedescendant={entries[index] ? `${id}-row-${index}` : undefined}
    >
      <thead
        ><tr
          >{#each columns.filter((c) => c.key !== 'harness' || browserState.harness === 'all') as c}<th
              class:extra={['project', 'harness', 'duration'].includes(c.key)}
              aria-sort={browserState.sort.key === c.key
                ? browserState.sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'}
              ><button tabindex="-1" onclick={() => sort(c.key)}
                >{c.label}{browserState.sort.key === c.key
                  ? browserState.sort.direction === 'asc'
                    ? ' ↑'
                    : ' ↓'
                  : ''}</button
              ></th
            >{/each}</tr
        ></thead
      >
      <tbody
        >{#each entries as { session, depth, total, note }, i (session.id)}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
          <tr
            id={`${id}-row-${i}`}
            class:selected={session.id === selectedId}
            class:focused={i === index}
            data-session-id={session.id}
            title={tooltip(session)}
            aria-label={[
              session.displayName,
              projectOf(session),
              formatSessionTime(session.modifiedAt),
              total ? formatSessionCost(total.usd) : total === null ? 'Cost unknown' : '',
            ]
              .filter(Boolean)
              .join(', ')}
            onclick={() => onSelect(session)}
          >
            <td style:padding-left={`${8 + depth * 16}px`}
              ><strong>{session.displayName}</strong><small
                ><span class="narrow-project"
                  >{projectOf(session) ?? ''}{projectOf(session) && session.firstPrompt
                    ? ' · '
                    : ''}</span
                >{session.firstPrompt ?? ''}</small
              >{#if browserState.includeChildren && browserState.sort.key !== 'changed' && session.parentReference}<small
                  >child of {sessions.find((s) => s.id === session.parentReference)?.displayName ??
                    session.parentReference}</small
                >{/if}</td
            >
            <td class="extra">{projectOf(session) ?? ''}</td>{#if browserState.harness === 'all'}<td
                class="extra">{harnessName(session)}</td
              >{/if}<td>{formatSessionTime(session.modifiedAt) ?? ''}</td><td class="extra"
              >{formatDuration(session)}</td
            >
            <td
              title={[total ? costNote(session, total) : 'No cost total available', note]
                .filter(Boolean)
                .join('; ')}
              >{#if total}{total.kind === 'estimated' ? '~' : ''}{formatSessionCost(
                  total.usd,
                )}{total.partial ? ' (partial)' : ''}{:else if total === null}Cost unknown{/if}{#if note}<small
                  >{note}</small
                >{/if}</td
            >
          </tr>
        {/each}</tbody
      >
    </table>
  </div>
  {#if entries.length === 0}<p>
      No sessions match these filters. <button
        onclick={() => (browserState = clearFilters(browserState))}>Clear filters</button
      >
    </p>{/if}
  <p role="status" aria-live="polite">{entries.length} sessions match.</p>
</div>

<style>
  div[role='region'] {
    grid-column: 1 / -1;
    min-width: 0;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .include-children {
    flex-direction: row;
    align-items: center;
    gap: 4px;
    height: 36px;
    white-space: nowrap;
  }
  .hidden-note {
    margin: 0;
  }
  .search-field {
    flex: 1 1 240px;
    min-width: 240px;
  }
  .search-field input {
    width: 100%;
    min-width: 0;
    font-size: 14px;
  }
  .filters input:not([type='checkbox']),
  .filters select,
  .filters > button {
    height: 36px;
    box-sizing: border-box;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  label {
    display: flex;
    flex-direction: column;
    font-size: 12px;
  }
  input,
  select,
  button {
    font: inherit;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--control-border);
    border-radius: var(--control-radius);
    padding: 7px;
  }
  .scroll {
    overflow: auto;
    min-height: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    table-layout: fixed;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--surface);
    text-align: left;
  }
  th:first-child {
    width: 32%;
  }
  th button {
    border: 0;
    text-align: left;
  }
  td {
    padding: 8px;
    border-bottom: 1px solid var(--control-border);
  }
  tr {
    cursor: pointer;
  }
  tr.selected {
    background: var(--action);
    color: var(--accent);
  }
  table:focus tr.focused {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  small {
    display: block;
    color: var(--secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  p {
    margin: 0;
    font-size: 12px;
    color: var(--secondary);
  }
  .narrow-project {
    display: none;
  }
  @container highwater (max-width:540px) {
    .search-field {
      flex-basis: 100%;
      min-width: 0;
      width: 100%;
    }
    .extra {
      display: none;
    }
    .narrow-project {
      display: inline;
    }
    th:first-child {
      width: 45%;
    }
  }
</style>
