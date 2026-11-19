<script module lang="ts">
  let nextPicker = 0;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { domRoot } from '../dom-root';
  let pickerRoot: HTMLDivElement;
  import type { SessionListItem } from '../api/client';
  import { formatSessionCost } from '../context-river/format';
  import { formatSessionTime, sessionOptionLabels } from '../session-label';
  import { sessionTree, withAncestors } from '../session-links';
  let {
    sessions,
    selectedId,
    onSelect,
  }: {
    sessions: SessionListItem[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  } = $props();

  const id = `session-picker-${nextPicker++}`;
  let harness: 'all' | 'pi' | 'opencode' | 'claude-code' | 'codex' | 'copilot' | 'vscode-copilot' =
    $state('all');
  /** Search text, used only while the list is open. */
  let query = $state('');
  /** Child sessions are reached from their parent, so the list leaves them out by default. */
  let includeChildren = $state(false);
  let open = $state(false);
  let activeIndex = $state(-1);
  const harnessOf = (session: SessionListItem) =>
    session.harness ??
    (session.id.startsWith('opencode-')
      ? 'opencode'
      : session.id.startsWith('claude-code-')
        ? 'claude-code'
        : session.id.startsWith('codex-')
          ? 'codex'
          : session.id.startsWith('copilot-')
            ? 'copilot'
            : session.id.startsWith('vscode-copilot-')
              ? 'vscode-copilot'
              : 'pi');
  // Duplicate portable references are ambiguous on the server. Offer one
  // option per reference instead of crashing a keyed list or selecting a DB.
  let unique = $derived([...new Map(sessions.map((session) => [session.id, session])).values()]);
  let labels = $derived(sessionOptionLabels(unique, harness === 'all'));
  let inFilters = $derived(
    sessionTree(
      unique.filter((session) => harness === 'all' || harnessOf(session) === harness),
    ).filter((entry) => includeChildren || entry.depth === 0),
  );
  // A child session that matches the search is shown under the sessions it descends from.
  let entries = $derived(
    withAncestors(inFilters, (session) =>
      `${session.displayName} ${session.workingDirectory ?? ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    ),
  );
  let choices = $derived(entries.map((entry) => entry.session));
  let selected = $derived(unique.find((session) => session.id === selectedId));
  let selectedLabel = $derived(
    selected
      ? `${labels.get(selected.id)}${inFilters.some((entry) => entry.session === selected) ? '' : ' — outside filters'}`
      : '',
  );
  const optionId = (index: number) => `${id}-option-${index}`;
  function costNote(
    session: SessionListItem,
    total: NonNullable<SessionListItem['total']>,
  ): string {
    if (total.kind === 'estimated') {
      return total.partial
        ? 'Estimated API-equivalent cost for calls with a known price'
        : 'Estimated API-equivalent cost for recorded calls';
    }
    if (total.kind === 'sum') {
      if (harnessOf(session) === 'pi') return 'Recorded Pi charges, including abandoned branches';
      if (harnessOf(session) === 'vscode-copilot') return 'Recorded credits at $0.01 each';
      return 'Sum of charges recorded by OpenCode';
    }
    if (harnessOf(session) === 'copilot') return 'Recorded by Copilot at its last usage checkpoint';
    const since =
      total.sinceMs === null ? null : formatSessionTime(new Date(total.sinceMs).toISOString());
    const recorded = `Claude Code's own total${since ? ` since ${since}` : ''}`;
    if (total.newerUsage) {
      const through =
        total.throughMs === undefined
          ? null
          : formatSessionTime(new Date(total.throughMs).toISOString());
      const started = session.startedAt === null ? NaN : Date.parse(session.startedAt);
      const restarted = total.sinceMs !== null && total.sinceMs > started;
      const label = restarted ? recorded : "Claude Code's own total";
      return `${label}${through ? ` through about ${through}` : ''}; later usage not included`;
    }
    return `${recorded}${total.partial ? ' (partial session)' : ''}`;
  }

  async function showActive(): Promise<void> {
    await tick();
    domRoot(pickerRoot)
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView?.({ block: 'nearest' });
  }
  function openList(): void {
    if (open) return;
    open = true;
    query = '';
    activeIndex = Math.max(
      0,
      choices.findIndex((session) => session.id === selectedId),
    );
    void showActive();
  }
  function close(): void {
    open = false;
    query = '';
    activeIndex = -1;
  }
  function choose(session: SessionListItem): void {
    close();
    if (session.id !== selectedId) onSelect(session.id);
  }
  function search(text: string): void {
    open = true;
    query = text;
    activeIndex = choices.length > 0 ? 0 : -1;
  }
  function move(step: number): void {
    if (!open) return openList();
    if (choices.length === 0) return;
    activeIndex = Math.min(choices.length - 1, Math.max(0, activeIndex + step));
    void showActive();
  }
  function key(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const session = choices[activeIndex];
      if (session) choose(session);
    } else if (event.key === 'Escape' && open) {
      // Closing the list must not also clear the River's selection.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  }
</script>

<div class="picker" bind:this={pickerRoot}>
  <!-- The menus explain themselves, so their labels are for screen readers only. -->
  <label class="harness-field"
    ><span class="visually-hidden">Harness</span>
    <select bind:value={harness}>
      <option value="all">All harnesses</option>
      <option value="pi">Pi</option>
      <option value="opencode">OpenCode</option>
      <option value="claude-code">Claude Code</option>
      <option value="codex">Codex</option>
      <option value="copilot">Copilot app and CLI</option>
      <option value="vscode-copilot">VS Code Copilot</option>
    </select>
  </label>
  <div class="session-field">
    <label class="visually-hidden" for={`${id}-input`}>Session</label>
    <input
      id={`${id}-input`}
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-expanded={open}
      aria-controls={`${id}-list`}
      aria-autocomplete="list"
      aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
      data-session-id={selectedId ?? ''}
      title={open ? undefined : selectedLabel}
      value={open ? query : selectedLabel}
      placeholder={open ? 'Search by title or directory' : 'Choose a session'}
      onclick={openList}
      oninput={(event) => search(event.currentTarget.value)}
      onkeydown={key}
      onblur={close}
    />
    {#if open}
      <!-- Pressing an option must not move focus away from the input and close the list first. -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label="Sessions"
        onmousedown={(event) => event.preventDefault()}
      >
        {#each entries as { session, depth }, index (session.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <li
            id={optionId(index)}
            role="option"
            aria-selected={session.id === selectedId}
            class:active={index === activeIndex}
            data-session-id={session.id}
            style:padding-inline-start={depth > 0 ? `${8 + depth * 16}px` : undefined}
            title={session.fileName || session.displayName}
            onclick={() => choose(session)}
          >
            <span class="option-label">{labels.get(session.id)}</span>
            {#if session.total}
              <span class="option-total" title={costNote(session, session.total)}>
                {session.total.kind === 'estimated' ? '~' : ''}{formatSessionCost(
                  session.total.usd,
                )}{session.total.partial ? ' (partial)' : ''}
              </span>
            {:else if session.total === null}
              <span class="option-total unknown-cost" title="No cost total available"
                >Cost unknown</span
              >
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <label class="include-children"
    ><input type="checkbox" bind:checked={includeChildren} /><span>Child sessions</span></label
  >
  {#if choices.length === 0}<p role="status">
      No sessions match these filters. The open session is unchanged.
    </p>{/if}
</div>

<style>
  .picker {
    /* The list spans both columns, so labels have room on narrow screens. */
    position: relative;
    display: grid;
    grid-template-columns: minmax(120px, 170px) minmax(0, 1fr) auto;
    grid-template-areas: 'harness session children';
    align-items: center;
    gap: 8px 12px;
    width: 100%;
    min-width: 0;
  }
  .harness-field {
    grid-area: harness;
  }
  .session-field {
    grid-area: session;
  }
  .picker > p {
    grid-column: 1 / -1;
    margin: 0;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  /* Narrow headers: the two menus keep their shared row, and Child sessions moves below. */
  @container highwater (max-width: 600px) {
    .picker {
      grid-template-columns: minmax(96px, 140px) minmax(0, 1fr);
      grid-template-areas:
        'harness session'
        'children children';
    }
    .include-children {
      justify-self: end;
    }
  }
  label,
  .session-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--secondary);
    font-size: var(--text-sm);
    min-width: 0;
  }
  select,
  input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    height: 36px;
    padding: 7px 32px 7px 9px;
    border: 1px solid var(--control-border);
    border-radius: var(--control-radius);
    background-color: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 14px;
  }
  input {
    text-overflow: ellipsis;
    /* Shows that the field opens a list, like the Harness dropdown beside it. */
    background-image: var(--chevron);
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 12px 8px;
  }
  input::placeholder {
    color: var(--secondary);
  }
  ul {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    z-index: 20;
    max-height: min(360px, 60vh);
    margin: 4px 0 0;
    padding: 4px;
    overflow-y: auto;
    list-style: none;
    border: 1px solid var(--control-border);
    border-radius: var(--control-radius);
    background: var(--surface);
    box-shadow: 0 8px 24px var(--shadow);
  }
  /* On a narrow screen the option's text is shortened rather than wrapped, so the Session field
     stays level with the Harness field. */
  .include-children {
    grid-area: children;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
  }
  .include-children span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .include-children input {
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 6px 8px;
    border-radius: var(--control-radius);
    color: var(--text);
    font-size: var(--text-md);
    white-space: nowrap;
    cursor: pointer;
  }
  .option-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .option-total {
    flex: none;
    text-align: right;
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .unknown-cost {
    color: var(--secondary);
    font-style: italic;
  }
  li[aria-selected='true'] {
    color: var(--accent);
  }
  li.active,
  li:hover {
    background: var(--action);
    color: var(--active-text);
  }
  li.active .unknown-cost,
  li:hover .unknown-cost {
    color: inherit;
  }
  p {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--secondary);
    font-size: var(--text-sm);
  }
</style>
