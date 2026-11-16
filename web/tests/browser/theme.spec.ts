import { expect, test, type Page } from '@playwright/test';
import { palettes, paletteList, THEME_KEY } from '../../src/lib/theme/palettes';
import { generation, mockApi } from './mock-api';
import { economicsScenario } from './economics-scenario';
import { expectThemePreference, selectTheme, themeRadio } from './theme-picker';

const integrated = process.env.HIGHWATER_BROWSER_INTEGRATED === '1';

async function loaded(page: Page) {
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page.getByTestId('live-status')).toHaveText('Live updates: live');
}

for (const system of ['light', 'dark'] as const) {
  test(`System follows ${system} appearance without persisting a default`, async ({ page }) => {
    test.skip(integrated, 'Uses deterministic mocked API responses.');
    await page.emulateMedia({ colorScheme: system });
    await mockApi(page);
    await page.goto('/');
    await loaded(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', system);
    await expectThemePreference(page, 'system');
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBeNull();
    const other = system === 'dark' ? 'light' : 'dark';
    await page.emulateMedia({ colorScheme: other });
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
    await selectTheme(page, system);
    await page.emulateMedia({ colorScheme: system });
    await page.emulateMedia({ colorScheme: other });
    await expect(page.locator('html')).toHaveAttribute('data-theme', system);
    await page.reload();
    await loaded(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', system);
    await expectThemePreference(page, system);
    await selectTheme(page, 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', other);
    await page.reload();
    await loaded(page);
    await expectThemePreference(page, 'system');
  });
}

for (const palette of paletteList) {
  test(`${palette.id} is applied before the application module loads`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: palette.colorScheme === 'dark' ? 'light' : 'dark' });
    await page.addInitScript(({ key, id }) => localStorage.setItem(key, JSON.stringify(id)), {
      key: THEME_KEY,
      id: palette.id,
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/(?:src\/main\.ts|assets\/index-[^/]+\.js)(?:\?.*)?$/, async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto('/', { waitUntil: 'commit' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', palette.id);
      const appearance = await page.locator('html').evaluate((root) => ({
        colorScheme: getComputedStyle(root).colorScheme,
        page: getComputedStyle(root).getPropertyValue('--page').trim(),
        background: getComputedStyle(root).backgroundColor,
      }));
      expect(appearance.colorScheme).toBe(palette.colorScheme);
      expect(appearance.page).toBe(palette.tokens.page);
      expect(appearance.background).not.toBe('rgba(0, 0, 0, 0)');
      await expect(page.locator('main')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`${palette.id}-before-app.png`) });
    } finally {
      release();
    }
  });
}

test('invalid or blocked storage does not prevent startup or in-memory choices', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic mocked API responses.');
  await page.emulateMedia({ colorScheme: 'light' });
  await mockApi(page);
  await page.addInitScript((key) => localStorage.setItem(key, '{bad json'), THEME_KEY);
  await page.goto('/');
  await loaded(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_KEY)).toBe('{bad json');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        throw new Error('blocked');
      },
    });
  });
  await page.reload();
  await loaded(page);
  await selectTheme(page, 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('switching palettes preserves chart state, geometry, URLs and requests', async ({
  page,
}, testInfo) => {
  test.skip(integrated, 'Uses deterministic mocked API responses.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) requests.push(request.url());
  });
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await loaded(page);
  await selectTheme(page, 'dark');
  const item = page
    .getByRole('application', { name: 'Context River' })
    .getByRole('button', { name: 'bash: npm test', exact: true });
  await item.click();
  await page.getByRole('button', { name: 'Pin model call 1', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  await page.getByRole('button', { name: 'Cache & cost', exact: true }).click();
  await expect(page.locator('.economics-track-svg')).toBeVisible();
  await page.locator('.call-details .usage-breakdown > summary').click();
  await expect(page.locator('.call-details .usage-breakdown')).toHaveAttribute('open', '');
  await page.waitForTimeout(500); // Allow the existing debounced viewport URL update to settle.
  const before = await page.evaluate(() => ({
    url: location.href,
    paths: [...document.querySelectorAll('.ribbon')].map((node) => node.getAttribute('d')),
    indexes: performance.getEntriesByName('highwater-index-start').length,
    scroll: document.querySelector('.river-scroll')?.scrollLeft,
    disclosures: [...document.querySelectorAll('details[open]')].map((node) => node.className),
  }));
  const requestCount = requests.length;
  const fillBefore = await page
    .locator('.ribbon')
    .first()
    .evaluate((node) => getComputedStyle(node).fill);
  await selectTheme(page, 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  await expect(page.getByRole('button', { name: 'Cache & cost', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  const after = await page.evaluate(() => ({
    url: location.href,
    paths: [...document.querySelectorAll('.ribbon')].map((node) => node.getAttribute('d')),
    indexes: performance.getEntriesByName('highwater-index-start').length,
    scroll: document.querySelector('.river-scroll')?.scrollLeft,
    disclosures: [...document.querySelectorAll('details[open]')].map((node) => node.className),
  }));
  expect(after).toEqual(before);
  expect(requests.length).toBe(requestCount);
  expect(
    await page
      .locator('.ribbon')
      .first()
      .evaluate((node) => getComputedStyle(node).fill),
  ).not.toBe(fillBefore);

  for (const palette of paletteList) {
    await selectTheme(page, palette.id);
    await page.getByRole('button', { name: 'Cost', exact: true }).click();
    await expect(page.locator('.cost-dot').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${palette.id}-river.png`), fullPage: true });
    await page.getByRole('button', { name: 'Cache', exact: true }).click();
    await page.getByRole('button', { name: 'Item types', exact: true }).click();
    const groupFills = await page
      .locator('.group-ribbon .ribbon')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
    expect(groupFills.length).toBeGreaterThan(0);
    for (const fill of groupFills) expect(Object.values(palette.itemTypes)).toContain(fill);
    const renderedFills = await page
      .locator('.group-ribbon .ribbon')
      .evaluateAll((nodes) =>
        [...new Set(nodes.map((node) => getComputedStyle(node).fill))].sort(),
      );
    const legendFills = await page
      .locator('.group-type-legend i')
      .evaluateAll((nodes) =>
        [...new Set(nodes.map((node) => getComputedStyle(node).backgroundColor))].sort(),
      );
    expect(renderedFills).toEqual(legendFills);
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    await page.getByRole('tab', { name: 'Composition', exact: true }).click();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.composition-list')).toBeVisible();
    await page.getByRole('button', { name: 'Treemap', exact: true }).click();
    await expect(page.locator('.composition-treemap')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${palette.id}-composition.png`),
      fullPage: true,
    });
    await page.getByRole('tab', { name: 'River', exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test('the theme toggle supports arrow keys without navigating calls', async ({ page }) => {
  test.skip(integrated, 'Uses deterministic mocked API responses.');
  test.skip(
    paletteList.length > 2,
    'Additional palettes use a native dropdown instead of the toggle.',
  );
  await mockApi(page);
  await page.goto('/');
  await loaded(page);
  await page.getByRole('button', { name: 'Pin model call 2', exact: true }).click();
  await themeRadio(page, 'system').focus();
  await themeRadio(page, 'system').press('ArrowRight');
  await expectThemePreference(page, 'light');
  await themeRadio(page, 'light').press('ArrowRight');
  await expectThemePreference(page, 'dark');
  await themeRadio(page, 'dark').press('ArrowRight');
  await expectThemePreference(page, 'system');
  await themeRadio(page, 'system').press('ArrowLeft');
  await expectThemePreference(page, 'dark');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await themeRadio(page, 'dark').press('Tab');
  await expect(themeRadio(page, 'dark')).not.toBeFocused();
});

for (const width of [390, 850, 1100, 1280, 1440]) {
  test(`both palettes fit the header and charts at ${width}px`, async ({ page }, testInfo) => {
    test.skip(integrated, 'Uses deterministic mocked API responses.');
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto('/');
    await loaded(page);
    const picker =
      paletteList.length > 2
        ? page.getByRole('combobox', { name: 'Theme', exact: true })
        : themeRadio(page, 'system');
    await picker.focus();
    await expect(picker).toBeFocused();
    const toggle = await page.locator('.theme-controls').boundingBox();
    const heading = await page
      .getByRole('heading', { name: 'Highwater', exact: true })
      .boundingBox();
    const sessionPicker = await page.locator('.session-controls .picker').boundingBox();
    const right = (box: { x: number; width: number }) => box.x + box.width;
    const bottom = (box: { y: number; height: number }) => box.y + box.height;
    const middle = (box: { y: number; height: number }) => box.y + box.height / 2;
    // The theme icons end at the header's right edge, on the title's row.
    expect(Math.abs(right(toggle!) - (width - (width <= 850 ? 16 : 26)))).toBeLessThanOrEqual(2);
    expect(Math.abs(middle(toggle!) - middle(heading!))).toBeLessThanOrEqual(6);
    // The picker has its own row below the title, from the left edge, at most 960px wide.
    expect(sessionPicker!.y).toBeGreaterThanOrEqual(bottom(heading!));
    expect(Math.abs(sessionPicker!.x - heading!.x)).toBeLessThanOrEqual(2);
    expect(sessionPicker!.width).toBeCloseTo(Math.min(960, width - (width <= 850 ? 32 : 52)), 0);
    for (const palette of paletteList) {
      await selectTheme(page, palette.id);
      await expect(page.getByRole('combobox', { name: 'Session' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.screenshot({
        path: testInfo.outputPath(`${palette.id}-${width}.png`),
        fullPage: true,
      });
    }
  });
}

test('Theme remains available in empty and error states', async ({ page }) => {
  test.skip(integrated, 'Uses deterministic mocked API responses.');
  await mockApi(page);
  await page.route('**/api/sessions', (route) => route.fulfill({ status: 500, body: 'Failed' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Could not discover sessions' })).toBeVisible();
  await selectTheme(page, 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.route('**/api/sessions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'X-Highwater-Server-Generation': generation,
        'X-Highwater-Catalog-Revision': '0',
        'X-Highwater-Live-Updates': 'active',
        etag: '"empty-catalog"',
      },
      body: JSON.stringify({ sessions: [] }),
    }),
  );
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No sessions discovered' })).toBeVisible();
  await selectTheme(page, 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
