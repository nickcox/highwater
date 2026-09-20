<script lang="ts">
  import type { SessionListItem } from '../api/client';
  export let sessions: SessionListItem[];
  export let selectedId: string | null;
  export let onSelect: (id: string) => void;
</script>

<label>Session
  <select value={selectedId ?? ''} onchange={(event) => onSelect(event.currentTarget.value)}>
    {#each sessions as session (session.id)}
      <option value={session.id} title={session.fileName}>{session.displayName}</option>
    {/each}
  </select>
</label>

<style>
  label { display: flex; flex-direction: column; gap: 4px; color: #9eabc0; font-size: 12px; min-width: min(440px, 100%); }
  select { max-width: 100%; }
</style>
