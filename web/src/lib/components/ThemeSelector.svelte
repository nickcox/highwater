<script lang="ts">
  import { themeController } from '../theme/controller';
  import { paletteList, palettes, type ThemePreference } from '../theme/palettes';

  const { preference } = themeController;
  const basicChoices = [
    { value: 'light', label: palettes.light.label },
    { value: 'dark', label: palettes.dark.label },
    { value: 'system', label: 'Auto' },
  ] as const;
</script>

{#if paletteList.length > 2}
  <label class="theme-selector">
    Theme
    <select
      value={$preference}
      onchange={(event) =>
        themeController.setPreference(event.currentTarget.value as ThemePreference)}
    >
      <option value="system">Auto</option>
      {#each paletteList as palette (palette.id)}
        <option value={palette.id}>{palette.label}</option>
      {/each}
    </select>
  </label>
{:else}
  <div class="theme-toggle" role="radiogroup" aria-label="Theme">
    {#each basicChoices as choice (choice.value)}
      <label
        title={choice.value === 'system' ? 'Follow system appearance' : `${choice.label} theme`}
      >
        <input
          type="radio"
          name="theme-preference"
          value={choice.value}
          checked={$preference === choice.value}
          onchange={() => themeController.setPreference(choice.value)}
        />
        <span class="choice" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="16" height="16">
            {#if choice.value === 'light'}
              <circle cx="8" cy="8" r="3" fill="currentColor" />
              <path
                d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
              />
            {:else if choice.value === 'dark'}
              <path
                d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z"
                fill="currentColor"
              />
            {:else}
              <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2Z" fill="currentColor" />
            {/if}
          </svg>
        </span>
        <span class="visually-hidden">{choice.label}</span>
      </label>
    {/each}
  </div>
{/if}

<style>
  .theme-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--secondary);
    font-size: var(--text-sm);
  }
  select {
    padding-right: 32px;
  }
  .theme-toggle {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--control-border);
    border-radius: var(--control-radius);
    background: var(--surface);
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .theme-toggle label {
    position: relative;
    cursor: pointer;
  }
  .theme-toggle input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  /* Icons at the height of the session menus beside them; each choice keeps its name for
     screen readers and in its tooltip. */
  .theme-toggle .choice {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid transparent;
    border-radius: var(--radius-small);
    color: var(--secondary);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  input:hover + .choice {
    background: var(--surface-raised);
    color: var(--text);
  }
  input:checked + .choice {
    border-color: var(--accent);
    background: var(--action);
    color: var(--active-text);
  }
  input:focus-visible + .choice {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
</style>
