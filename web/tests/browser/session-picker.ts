import type { Page } from '@playwright/test';

/** Choose a session by its reference the way a person does: open the picker and click it. */
export async function chooseSession(page: Page, id: string): Promise<void> {
  const control = page.getByRole('button', { name: /^Session:/ });
  if ((await control.getAttribute('aria-expanded')) !== 'true') await control.click();
  const grid = page.getByRole('grid', { name: 'Sessions' });
  await grid.locator(`[data-session-id="${id}"]`).click();
}
