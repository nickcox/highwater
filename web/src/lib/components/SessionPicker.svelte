<script lang="ts">
  import type { SessionListItem } from '../api/client';
  import { sessionOptionLabels } from '../session-label';
  export let sessions: SessionListItem[];
  export let selectedId: string | null;
  export let onSelect: (id: string) => void;

  let harness: 'all' | 'pi' | 'opencode' | 'claude-code' = 'all';
  let search = '';
  const harnessOf = (session: SessionListItem) =>
    session.harness ??
    (session.id.startsWith('opencode-')
      ? 'opencode'
      : session.id.startsWith('claude-code-')
        ? 'claude-code'
        : 'pi');
  $: filtered = sessions.filter(
    (session) =>
      (harness === 'all' || harnessOf(session) === harness) &&
      `${session.displayName} ${session.workingDirectory ?? ''}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  // Duplicate portable references are ambiguous on the server. Render one
  // option per reference instead of crashing a keyed list or selecting a DB.
  $: choices = [...new Map(filtered.map((session) => [session.id, session])).values()];
  $: selected = sessions.find((session) => session.id === selectedId);
  $: selectedVisible = choices.some((session) => session.id === selectedId);
  $: labels = sessionOptionLabels(choices, harness === 'all');
</script>

<div class="picker">
  <div class="filters">
    <label
      >Harness
      <select bind:value={harness}>
        <option value="all">All harnesses</option>
        <option value="pi">Pi</option>
        <option value="opencode">OpenCode</option>
        <option value="claude-code">Claude Code</option>
      </select>
    </label>
    <label
      >Search sessions<input
        type="search"
        bind:value={search}
        placeholder="Title or directory"
      /></label
    >
  </div>
  <label
    >Session
    <select value={selectedId ?? ''} onchange={(event) => onSelect(event.currentTarget.value)}>
      {#if !selectedVisible}<option value={selectedId ?? ''} disabled
          >{selected ? `${selected.displayName} — outside filters` : 'Choose a session'}</option
        >{/if}
      {#each choices as session (session.id)}
        <option value={session.id} title={session.fileName || session.displayName}>
          {labels.get(session.id)}
        </option>
      {/each}
    </select>
  </label>
  {#if choices.length === 0}<p role="status">
      No sessions match these filters. The open session is unchanged.
    </p>{/if}
</div>

<style>
  .picker {
    display: grid;
    grid-template-columns: 140px minmax(160px, 200px) minmax(0, 1fr);
    align-items: start;
    gap: 8px;
    width: min(760px, 100%);
    min-width: 0;
  }
  .filters {
    display: contents;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #9eabc0;
    font-size: 12px;
    min-width: 0;
  }
  select,
  input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    height: 36px;
    padding: 7px 9px;
    border: 1px solid var(--control-border);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 14px;
  }
  input::placeholder {
    color: var(--secondary);
  }
  select:focus-visible,
  input:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  p {
    grid-column: 1 / -1;
    margin: 0;
    color: #9eabc0;
    font-size: 12px;
  }
  @media (max-width: 650px) {
    .picker {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .picker > label {
      grid-column: 1 / -1;
    }
  }
</style>
