import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import ThemeSelector from './ThemeSelector.svelte';
import { themeController } from '../theme/controller';
import { paletteList, palettes, THEME_KEY, type Palette } from '../theme/palettes';

vi.mock('../theme/palettes', async (importOriginal) => {
  const original = await importOriginal<typeof import('../theme/palettes')>();
  return { ...original, paletteList: [original.palettes.dark, original.palettes.light] };
});

let stop: () => void;
let setItem: ReturnType<typeof vi.fn>;
beforeEach(() => {
  setItem = vi.fn();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  stop = themeController.start();
});
afterEach(() => {
  cleanup();
  stop();
  (paletteList as Palette[]).splice(2);
  vi.unstubAllGlobals();
});

describe('Theme picker', () => {
  it('shows Light, Dark and Auto as one radio group, with Auto initially selected', () => {
    render(ThemeSelector);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => (radio as HTMLInputElement).value),
    ).toEqual(['light', 'dark', 'system']);
    expect(within(group).getByRole('radio', { name: 'Auto' })).toBeChecked();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });
  it('changes the preference and keeps the active choice checked', async () => {
    render(ThemeSelector);
    for (const [label, value] of [
      ['Light', 'light'],
      ['Dark', 'dark'],
      ['Auto', 'system'],
    ]) {
      await fireEvent.click(screen.getByRole('radio', { name: label }));
      expect(screen.getByRole('radio', { name: label })).toBeChecked();
      expect(setItem).toHaveBeenLastCalledWith(THEME_KEY, JSON.stringify(value));
    }
    expect(document.documentElement.dataset.theme).toBe('light');
  });
  it('uses a dropdown when additional named palettes are registered', async () => {
    (paletteList as Palette[]).push({
      ...palettes.light,
      id: 'test-palette',
      label: 'Test palette',
    });
    render(ThemeSelector);
    const selector = screen.getByRole('combobox', { name: 'Theme' });
    expect(
      within(selector)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Auto', 'Dark', 'Light', 'Test palette']);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await fireEvent.change(selector, { target: { value: 'dark' } });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(setItem).toHaveBeenLastCalledWith(THEME_KEY, '"dark"');
  });
});
