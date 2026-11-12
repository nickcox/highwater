import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { createThemeController } from './controller';
import { palettes } from './palettes';
import { themeCss } from '../../../scripts/theme-html';

describe('caller-supplied theme', () => {
  it('sets only the palette store, without page, preference or system access', () => {
    const html = document.documentElement.outerHTML;
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const controller = createThemeController();
    controller.setPalette('light');
    expect(get(controller.palette)).toBe(palettes.light);
    expect(get(controller.preference)).toBe('system');
    controller.setPalette('dark');
    expect(get(controller.palette)).toBe(palettes.dark);
    expect(storage).not.toHaveBeenCalled();
    expect(document.documentElement.outerHTML).toBe(html);
    storage.mockRestore();
  });

  it('uses the same palette declarations for the standalone page and shadow host', () => {
    const standalone = themeCss();
    const embedded = themeCss(undefined, ':host');
    expect(standalone).toContain('html[data-theme="light"]');
    expect(embedded).toContain(':host([data-theme="light"])');
    expect(embedded).not.toContain('html');
    const declarations = (css: string) =>
      [...css.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    expect(declarations(embedded)).toEqual(
      declarations(standalone).filter((value) => value !== 'background:var(--page)'),
    );
  });
});
