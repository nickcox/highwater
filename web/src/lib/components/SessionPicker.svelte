<script context="module" lang="ts">
  let nextPicker = 0;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { SessionListItem } from '../api/client';
  import { sessionOptionLabels } from '../session-label';
  export let sessions: SessionListItem[];
  export let selectedId: string | null;
  export let onSelect: (id: string) => void;

  const id = `session-picker-${nextPicker++}`;
  let harness: 'all' | 'pi' | 'opencode' | 'claude-code' | 'vscode-copilot' = 'all';
  /** Search text, used only while the list is open. */
  let query = '';
  let open = false;
  let activeIndex = -1;
  const harnessOf = (session: SessionListItem) =>
    session.harness ??
    (session.id.startsWith('opencode-')
      ? 'opencode'
      : session.id.startsWith('claude-code-')
        ? 'claude-code'
        : session.id.startsWith('vscode-copilot-')
          ? 'vscode-copilot'
          : 'pi');
  // Duplicate portable references are ambiguous on the server. Offer one
  // option per reference instead of crashing a keyed list or selecting a DB.
  $: unique = [...new Map(sessions.map((session) => [session.id, session])).values()];
  $: labels = sessionOptionLabels(unique, harness === 'all');
  $: inHarness = unique.filter((session) => harness === 'all' || harnessOf(session) === harness);
  $: choices = inHarness.filter((session) =>
    `${session.displayName} ${session.workingDirectory ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  $: selected = unique.find((session) => session.id === selectedId);
  $: selectedLabel = selected
    ? `${labels.get(selected.id)}${inHarness.includes(selected) ? '' : ' — outside filters'}`
    : '';
  const optionId = (index: number) => `${id}-option-${index}`;

  async function showActive(): Promise<void> {
    await tick();
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' });
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

<div class="picker">
  <label
    >Harness
    <select bind:value={harness}>
      <option value="all">All harnesses</option>
      <option value="pi">Pi</option>
      <option value="opencode">OpenCode</option>
      <option value="claude-code">Claude Code</option>
      <option value="vscode-copilot">VS Code Copilot</option>
    </select>
  </label>
  <div class="session-field">
    <label for={`${id}-input`}>Session</label>
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
        {#each choices as session, index (session.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <li
            id={optionId(index)}
            role="option"
            aria-selected={session.id === selectedId}
            class:active={index === activeIndex}
            data-session-id={session.id}
            title={session.fileName || session.displayName}
            onclick={() => choose(session)}
          >
            {labels.get(session.id)}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {#if choices.length === 0}<p role="status">
      No sessions match these filters. The open session is unchanged.
    </p>{/if}
</div>

<style>
  .picker {
    /* The list spans both columns, so labels have room on narrow screens. */
    position: relative;
    display: grid;
    grid-template-columns: minmax(96px, 140px) minmax(0, 1fr);
    align-items: start;
    gap: 8px 16px;
    width: min(600px, 100%);
    min-width: 0;
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
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
  }
  li {
    padding: 6px 8px;
    border-radius: var(--control-radius);
    color: var(--text);
    font-size: var(--text-md);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }
  li[aria-selected='true'] {
    color: var(--accent);
  }
  li.active,
  li:hover {
    background: var(--action);
    color: #fff;
  }
  p {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--secondary);
    font-size: var(--text-sm);
  }
</style>
