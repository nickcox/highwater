<script lang="ts">
  export let value: string;
  export let label: string;

  let status = '';

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
    background: #151e35;
    border: 1px solid #34415f;
    border-radius: 6px;
    color: #e2e8f3;
    cursor: pointer;
    padding: 3px 7px;
    font: inherit;
    font-size: 11px;
  }
  button:focus-visible {
    outline: 2px solid #9fc0ff;
    outline-offset: 2px;
  }
  .copy-status {
    color: #9fb2d5;
    font-size: 11px;
  }
</style>
