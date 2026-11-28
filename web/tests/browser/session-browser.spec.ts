import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';
for (const width of [500, 1280]) {
  test(`session browser filters, sorts and closes at ${width}px`, async ({ page }) => {
    test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue.');
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto('/');
    const browse = page.getByRole('button', { name: /^Session:/ });
    await browse.click();
    const search = page.getByRole('textbox', { name: 'Search sessions' });
    await expect(search).toBeFocused();
    await expect(page.getByRole('grid', { name: 'Sessions' })).toBeVisible();
    if (width === 1280) {
      const section = await page.getByRole('region', { name: 'Session browser' }).boundingBox();
      expect(section!.width).toBeGreaterThan(1100);
    }
    await page.getByRole('button', { name: /^Title/ }).click();
    await expect(page.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await search.fill('not-a-session');
    await expect(browse).toHaveAccessibleName(/1 filter/);
    await expect(page.getByRole('status').filter({ hasText: '0 sessions match.' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(browse).not.toHaveAccessibleName(/filter/);
    await search.press('Escape');
    await expect(browse).toBeFocused();
    await expect(browse).toHaveAttribute('aria-expanded', 'false');
    await browse.click();
    const grid = page.getByRole('grid', { name: 'Sessions' });
    if (width === 500)
      await expect(grid.getByRole('columnheader', { name: 'Project' })).toBeHidden();
    await grid.focus();
    await grid.press('Home');
    await grid.press('Enter');
    await expect(browse).toHaveAttribute('aria-expanded', 'false');
  });
}

for (const width of [500, 1280]) {
  test(`session button keyboard and filters at ${width}px`, async ({ page }) => {
    test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue.');
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto('/');
    const control = page.getByRole('button', { name: /^Session:/ });
    await control.focus();
    await control.press('t');
    const search = page.getByRole('textbox', { name: 'Search sessions' });
    const grid = page.getByRole('grid', { name: 'Sessions' });
    await expect(search).toHaveValue('t');
    await expect(search).toBeFocused();
    await search.press('ArrowDown');
    await expect(grid).toBeFocused();
    await grid.press('ArrowUp');
    await expect(search).toBeFocused();
    await search.press('ArrowDown');
    await grid.press('e');
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('te');
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await page.getByRole('combobox', { name: 'Harness' }).selectOption('codex');
    await expect(control).toHaveAccessibleName(/1 filter/);
    await expect(
      page.getByText('The open session is hidden by these filters.', { exact: false }),
    ).toBeVisible();
    await page.getByRole('checkbox', { name: 'Child sessions' }).check();
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByRole('checkbox')).toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Harness' })).toHaveValue('all');
    await search.press('ArrowDown');
    await grid.press('Enter');
    await expect(control).toBeFocused();
    await expect(control).toHaveAttribute('aria-expanded', 'false');
    await control.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });
    await control.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本' }));
    });
    await expect(search).toHaveValue('日本');
    await search.press('Escape');
    await expect(control).toBeFocused();
  });
}

for (const width of [390, 500, 1280]) {
  test(`filter controls align and search has room at ${width}px`, async ({ page }) => {
    test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue.');
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^Session:/ }).click();
    const filters = page.locator('.filters');
    const search = (await page.getByRole('textbox', { name: 'Search sessions' }).boundingBox())!;
    const menus = await Promise.all(
      ['Harness', 'Project', 'Changed', 'Cost'].map((name) =>
        page.getByRole('combobox', { name, exact: true }).boundingBox(),
      ),
    );
    const checkbox = (await page.getByRole('checkbox', { name: 'Child sessions' }).boundingBox())!;
    if (width <= 540) {
      const box = (await filters.boundingBox())!;
      expect(search.x).toBeCloseTo(box.x, 0);
      expect(search.width).toBeCloseTo(box.width, 0);
      for (const menu of menus) expect(menu!.y).toBeGreaterThanOrEqual(search.y + search.height);
    } else {
      for (const menu of menus)
        expect(menu!.y + menu!.height).toBeCloseTo(search.y + search.height, 0);
      expect(checkbox.y + checkbox.height / 2).toBeCloseTo(search.y + search.height / 2, 0);
      const clear = (await filters.getByRole('button', { name: 'Clear filters' }).boundingBox())!;
      expect(clear.y + clear.height).toBeCloseTo(search.y + search.height, 0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

test('old saved filters do not hide the startup session and new writes contain only settings', async ({
  page,
}) => {
  test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue.');
  await mockApi(page);
  await page.addInitScript(() => {
    const key = 'highwater.sessionBrowser.v1';
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          includeChildren: true,
          sort: { key: 'title', direction: 'asc' },
          harness: 'codex',
          project: 'old project',
          changed: 'today',
          cost: 'over20',
          search: 'absent',
        }),
      );
  });
  await page.goto('/');
  const control = page.getByRole('button', { name: /^Session:/ });
  await expect(control).toHaveAttribute('data-session-id', 'browser-smoke');
  await expect(control).not.toHaveAccessibleName(/filter/);
  await control.click();
  const search = page.getByRole('textbox', { name: 'Search sessions' });
  await expect(search).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Harness' })).toHaveValue('all');
  await expect(
    page.getByText('The open session is hidden by these filters.', { exact: false }),
  ).not.toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(page.getByRole('checkbox', { name: 'Child sessions' })).toBeChecked();
  await search.fill('absent');
  await expect(
    page.getByText('The open session is hidden by these filters.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Child sessions' }).uncheck();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('highwater.sessionBrowser.v1')!)),
    )
    .toEqual({ version: 1, includeChildren: false, sort: { key: 'title', direction: 'asc' } });
  await page.reload();
  await expect(control).not.toHaveAccessibleName(/filter/);
  await expect(control).toHaveAttribute('data-session-id', 'browser-smoke');
  await control.click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: 'Child sessions' })).not.toBeChecked();
});
