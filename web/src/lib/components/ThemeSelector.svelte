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
        <span>{choice.label}</span>
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
  .theme-toggle span {
    display: block;
    padding: 5px 9px;
    border: 1px solid transparent;
    border-radius: var(--radius-small);
    color: var(--secondary);
  }
  input:hover + span {
    background: var(--surface-raised);
    color: var(--text);
  }
  input:checked + span {
    border-color: var(--accent);
    background: var(--action);
    color: var(--active-text);
  }
  input:focus-visible + span {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
</style>
