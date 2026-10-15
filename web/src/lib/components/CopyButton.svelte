<script lang="ts">
  let { value, label }: { value: string; label: string } = $props();

  let status = $state('');

  async function copyValue(): Promise<void> {
    try {
      const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
      if (!clipboard?.writeText) {
        status = `Clipboard is unavailable. Select the ${label} text and copy it manually.`;
        return;
      }
      await clipboard.writeText(value);
      status = `${label.charAt(0).toUpperCase()}${label.slice(1)} copied.`;
    } catch {
      status = `Could not copy ${label}. Select the text and copy it manually.`;
    }
  }
</script>

<span class="copy-control">
  <button type="button" aria-label={`Copy ${label}`} onclick={copyValue}>Copy</button>
  <span class="copy-status" role="status">{status}</span>
</span>

<style>
  .copy-control {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px 8px;
    min-width: 0;
  }
  button {
    background: var(--surface);
    border: 1px solid var(--separator);
    border-radius: var(--control-radius);
    color: var(--text);
    cursor: pointer;
    padding: 3px 7px;
    font: inherit;
    font-size: var(--text-xs);
  }
  .copy-status {
    color: var(--secondary);
    font-size: var(--text-xs);
  }
</style>
