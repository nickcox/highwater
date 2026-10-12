import type { Page } from '@playwright/test';

/** Choose a session by its reference the way a person does: open the picker and click it. */
export async function chooseSession(page: Page, id: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Session' }).click();
  await page.locator(`[role="option"][data-session-id="${id}"]`).click();
}
