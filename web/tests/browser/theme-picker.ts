import { expect, type Page } from '@playwright/test';
import { paletteList } from '../../src/lib/theme/palettes';

export function themeRadio(page: Page, preference: string) {
  const name =
    preference === 'system'
      ? 'Auto'
      : paletteList.find((palette) => palette.id === preference)?.label;
  if (!name) throw new Error(`Unknown theme preference: ${preference}`);
  return page
    .getByRole('radiogroup', { name: 'Theme', exact: true })
    .getByRole('radio', { name, exact: true });
}

export async function selectTheme(page: Page, preference: string) {
  if (paletteList.length > 2)
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(preference);
  else await themeRadio(page, preference).check();
}

export async function expectThemePreference(page: Page, preference: string) {
  if (paletteList.length > 2)
    await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue(
      preference,
    );
  else await expect(themeRadio(page, preference)).toBeChecked();
}
