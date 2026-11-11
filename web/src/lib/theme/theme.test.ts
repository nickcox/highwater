import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createThemeController } from './controller';
import {
  ITEM_COLOR_SLOT_COUNT,
  paletteIds,
  paletteList,
  palettes,
  parseThemePreference,
  resolvePalette,
  THEME_KEY,
} from './palettes';
import { contrastRatio } from '../context-river/colors';
import { themeBootstrap, themeCss } from '../../../scripts/theme-html';

let stop: (() => void) | undefined;
let dark = false;
let listeners: Set<() => void>;
let values: Map<string, string>;
let setItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  dark = false;
  listeners = new Set();
  values = new Map();
  setItem = vi.fn((key: string, value: string) => values.set(key, value));
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return dark;
      },
      addEventListener: (_event: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_event: string, fn: () => void) => listeners.delete(fn),
    })),
  );
});
afterEach(() => {
  stop?.();
  stop = undefined;
  document.documentElement.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

function systemChange(next: boolean) {
  dark = next;
  for (const listener of listeners) listener();
}
function bootstrap() {
  new Function('window', 'document', themeBootstrap())(window, document);
}

describe('palette contract', () => {
  it('has complete, unique palettes with a fixed slot count and valid colours', () => {
    expect(new Set(paletteIds).size).toBe(paletteList.length);
    for (const [id, palette] of Object.entries(palettes)) expect(palette.id).toBe(id);
    for (const palette of paletteList) {
      expect(Object.keys(palette.tokens).sort()).toEqual(Object.keys(palettes.dark.tokens).sort());
      expect(palette.items).toHaveLength(ITEM_COLOR_SLOT_COUNT);
      expect(new Set(palette.items).size).toBe(ITEM_COLOR_SLOT_COUNT);
      for (const value of [
        ...Object.values(palette.tokens),
        ...palette.items,
        ...Object.values(palette.itemTypes),
      ])
        expect(value).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i);
    }
  });
  for (const palette of paletteList) {
    it(`${palette.id}: keeps normal text and semantic text readable`, () => {
      for (const surface of [
        'page',
        'surface',
        'plot',
        'surface-raised',
        'selected-surface',
      ] as const)
        for (const text of ['text', 'text-strong', 'secondary', 'muted'] as const)
          expect(
            contrastRatio(palette.tokens[text], palette.tokens[surface]),
            `${text} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
      for (const [foreground, background] of [
        ['warning', 'warning-surface'],
        ['error', 'error-surface'],
        ['active-text', 'action'],
        ['event-compaction-text', 'event-compaction-fill'],
        ['event-warning-text', 'event-warning'],
        ['event-success-text', 'event-success'],
      ] as const)
        expect(
          contrastRatio(palette.tokens[foreground], palette.tokens[background]),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
    });
    it(`${palette.id}: makes controls and chart indicators visible`, () => {
      for (const surface of ['page', 'surface', 'plot'] as const) {
        expect(
          contrastRatio(palette.tokens['control-border'], palette.tokens[surface]),
          `border on ${surface}`,
        ).toBeGreaterThanOrEqual(3);
        expect(
          contrastRatio(palette.tokens.accent, palette.tokens[surface]),
          `focus on ${surface}`,
        ).toBeGreaterThanOrEqual(3);
      }
      for (const token of [
        'selection',
        'cost',
        'api-cost',
        'compaction',
        'cache-read',
        'cache-write',
        'cache-fresh',
        'cache-nonread',
      ] as const)
        expect(
          contrastRatio(palette.tokens[token], palette.tokens.plot),
          token,
        ).toBeGreaterThanOrEqual(3);
    });
  }
  it('generates CSS for arbitrary registered palettes without component changes', () => {
    const third = { ...palettes.light, id: 'test-palette', label: 'Test palette' };
    expect(themeCss([...paletteList, third])).toContain(
      'html[data-theme="test-palette"]{color-scheme:light;',
    );
    expect(themeCss()).toContain(
      `--item-type-userMessage:${palettes.light.itemTypes.userMessage};`,
    );
    expect(themeCss()).toContain('html{background:var(--page)}');
  });
});

describe('theme preferences and startup', () => {
  const invalid = [null, '', '{', '{}', '[]', '"unknown"', '"system"'.repeat(100), '1'];
  it.each(invalid)('falls back safely for %s', (raw) => {
    expect(parseThemePreference(raw, paletteIds)).toBe('system');
  });
  it.each(['system', ...paletteIds])('accepts %s', (id) => {
    expect(parseThemePreference(JSON.stringify(id), paletteIds)).toBe(id);
  });
  it('resolves System independently of explicit palette choices', () => {
    expect(resolvePalette('system', false)).toBe(palettes.light);
    expect(resolvePalette('system', true)).toBe(palettes.dark);
    expect(resolvePalette('light', true)).toBe(palettes.light);
    expect(resolvePalette('dark', false)).toBe(palettes.dark);
  });
  it('follows System, persists only explicit changes and removes its listener', () => {
    const controller = createThemeController();
    stop = controller.start();
    expect(get(controller.palette)).toBe(palettes.light);
    expect(setItem).not.toHaveBeenCalled();
    systemChange(true);
    expect(get(controller.palette)).toBe(palettes.dark);
    expect(setItem).not.toHaveBeenCalled();
    controller.setPreference('light');
    expect(values.get(THEME_KEY)).toBe('"light"');
    systemChange(false);
    systemChange(true);
    expect(get(controller.palette)).toBe(palettes.light);
    expect(get(controller.preference)).toBe('light');
    controller.setPreference('system');
    expect(get(controller.palette)).toBe(palettes.dark);
    stop();
    stop = undefined;
    expect(listeners.size).toBe(0);
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
  it('keeps the in-memory choice usable when storage access throws', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    const controller = createThemeController();
    expect(() => {
      stop = controller.start();
    }).not.toThrow();
    expect(() => controller.setPreference('dark')).not.toThrow();
    expect(get(controller.palette)).toBe(palettes.dark);
  });
  it('uses the same bootstrap and controller resolution for every saved value and system scheme', () => {
    for (const raw of [...invalid, '"system"', ...paletteIds.map((id) => JSON.stringify(id))]) {
      for (const systemDark of [false, true]) {
        dark = systemDark;
        if (raw === null) values.delete(THEME_KEY);
        else values.set(THEME_KEY, raw);
        bootstrap();
        const early = document.documentElement.dataset.theme;
        const controller = createThemeController();
        const dispose = controller.start();
        expect(get(controller.palette).id).toBe(early);
        dispose();
      }
    }
    expect(setItem).not.toHaveBeenCalled();
  });
  it('bootstraps despite blocked storage and unavailable media queries', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    vi.stubGlobal('matchMedia', () => {
      throw new Error('unsupported');
    });
    expect(bootstrap).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
