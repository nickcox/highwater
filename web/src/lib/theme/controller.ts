import { readonly, writable } from 'svelte/store';
import {
  paletteIds,
  palettes,
  parseThemePreference,
  resolvePalette,
  THEME_KEY,
  type Palette,
  type ThemePreference,
} from './palettes';

export function createThemeController() {
  const preference = writable<ThemePreference>('system');
  const palette = writable<Palette>(palettes.dark);
  let current: ThemePreference = 'system';
  let media: MediaQueryList | null = null;
  let root: HTMLElement | null = null;

  function apply(): void {
    const resolved = resolvePalette(current, media?.matches ?? true);
    preference.set(current);
    palette.set(resolved);
    if (root) root.dataset.theme = resolved.id;
  }

  function setPreference(next: ThemePreference): void {
    current = parseThemePreference(JSON.stringify(next), paletteIds) as ThemePreference;
    apply();
    try {
      window.localStorage.setItem(THEME_KEY, JSON.stringify(current));
    } catch {
      // The in-memory choice still works when browser storage is blocked.
    }
  }

  /** Embedders supply the palette without taking ownership of the page or preferences. */
  function setPalette(id: keyof typeof palettes): void {
    palette.set(palettes[id]);
  }

  function start(): () => void {
    root = document.documentElement;
    const previousTheme = root.getAttribute('data-theme');
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(THEME_KEY);
    } catch {
      // An inaccessible preference is equivalent to a missing one.
    }
    current = parseThemePreference(raw, paletteIds) as ThemePreference;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      media = null;
    }
    const onChange = () => {
      if (current === 'system') apply();
    };
    media?.addEventListener('change', onChange);
    apply();
    return () => {
      media?.removeEventListener('change', onChange);
      if (previousTheme === null) root?.removeAttribute('data-theme');
      else root?.setAttribute('data-theme', previousTheme);
      root = null;
      media = null;
      current = 'system';
      preference.set(current);
      palette.set(palettes.dark);
    };
  }

  return {
    preference: readonly(preference),
    palette: readonly(palette),
    setPreference,
    setPalette,
    start,
  };
}

export const themeController = createThemeController();
export const activePalette = themeController.palette;
