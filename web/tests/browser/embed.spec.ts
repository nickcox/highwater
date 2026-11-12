import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { testAnalysis } from '../../src/lib/context-river/test-data';
import { toWireAnalysis } from '../../src/lib/testing/wire-analysis';
import { sessionScenario } from '../../src/lib/testing/session-scenarios';
import type {} from '../embed-harness';

const integrated = process.env.HIGHWATER_BROWSER_INTEGRATED === '1';
test.skip(integrated, 'The embed harness is a separate library consumer, served by Vite.');

async function open(page: Page): Promise<void> {
  const bundle = await readFile(
    new URL('../../../integrations/bb/vendor/highwater-embed.js', import.meta.url),
    'utf8',
  );
  await page.route('**/embed-module.js*', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: bundle }),
  );
  await page.addInitScript((analysis) => {
    window.highwaterPayload = analysis;
  }, toWireAnalysis(testAnalysis()));
  await page.setViewportSize({ width: 1400, height: 1100 });
  await page.goto('/tests/embed.html');
  await expect(
    page.locator('#embed').getByRole('application', { name: 'Context River' }),
  ).toBeVisible();
  await expect(
    page.locator('#embed').getByRole('button', { name: 'Next call', exact: true }),
  ).toBeEnabled();
}

test('built module uses its container and theme without changing the host page or shortcuts', async ({
  page,
}, testInfo) => {
  await open(page);
  const app = page.locator('#embed');
  const outside = page.getByRole('button', { name: 'Outside button' });
  await expect(outside).toHaveCSS('background-color', 'rgb(200, 20, 40)');
  await expect(page.getByRole('heading', { name: 'Unrelated host page' })).toHaveCSS(
    'font-family',
    /serif/,
  );
  await outside.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('l');
  await expect(app.locator('#pinned-call-summary')).toHaveCount(0);
  await app.getByRole('button', { name: 'Pin model call 1', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(app.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await expect(app.getByRole('button', { name: 'Pin model call 2', exact: true })).toBeFocused();
  const columns = await app
    .locator('.exploration-grid')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(columns.split(' ')).toHaveLength(1);
  const geometry = await app
    .locator('.river-ribbon-geometry path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')));
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((theme) => window.highwaterHarness.setTheme(theme), theme);
    await expect(app).toHaveAttribute('data-theme', theme);
    expect(
      await app
        .locator('.river-ribbon-geometry path')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d'))),
    ).toEqual(geometry);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(
      false,
    );
    expect(await page.evaluate(() => localStorage.getItem('highwater.theme.v1'))).toBeNull();
    await expect(outside).toHaveCSS('background-color', 'rgb(200, 20, 40)');
    await page.screenshot({ path: testInfo.outputPath(`embed-${theme}.png`), fullPage: true });
  }
  await app.getByRole('button', { name: 'Item types', exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('test.highwater.presentation')!).river.display,
    ),
  ).toBe('itemTypes');
  expect(await page.evaluate(() => localStorage.getItem('highwater.presentation.v1'))).toBeNull();
  const group = app.getByRole('button', { name: /^Item type / }).first();
  await group.focus();
  await page.keyboard.press('Enter');
  const dialog = app.getByRole('dialog', { name: /^Item type .* breakdown$/ });
  await expect(dialog).toBeVisible();
  await expect(app.getByRole('button', { name: 'Close item type breakdown' })).toBeFocused();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1400);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(group).toBeFocused();
  await expect(app.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await app.getByRole('button', { name: 'Clear selected item and pinned call' }).click();
  await expect(app.getByRole('button', { name: 'Fit all calls', exact: true })).toBeDisabled();
  await app.getByRole('application', { name: 'Context River' }).focus();
  await page.evaluate(() =>
    window.addEventListener(
      'keydown',
      (event) => {
        document.documentElement.setAttribute(
          'data-escape-unhandled',
          String(!event.defaultPrevented),
        );
      },
      { once: true },
    ),
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-escape-unhandled', 'true');
  await app.evaluate((el) => {
    el.style.width = '1100px';
  });
  await app.getByRole('button', { name: 'Items', exact: true }).click();
  await app.getByRole('button', { name: 'bash: npm test', exact: true }).first().hover();
  const hover = app.locator('.item-hover-position');
  await expect(hover).toBeVisible();
  const hoverBounds = await hover.boundingBox();
  expect(hoverBounds!.x).toBeGreaterThanOrEqual(0);
  expect(hoverBounds!.x + hoverBounds!.width).toBeLessThanOrEqual(1400);
});

test('updates reconcile selections, reset new sessions, and retain cached data on errors', async ({
  page,
}) => {
  await open(page);
  const app = page.locator('#embed');
  await app.getByRole('button', { name: 'bash: npm test', exact: true }).first().click();
  await app.getByRole('button', { name: 'Pin model call 2', exact: true }).click();
  await expect(app.getByRole('button', { name: 'Follow latest' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(testAnalysis()),
  );
  await expect(app.locator('#selected-item-summary')).toBeVisible();
  await expect(app.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await page.evaluate(() => window.highwaterHarness.fail());
  await expect(app.getByRole('alert')).toContainText('Test analysis is unavailable');
  await expect(app.getByRole('application', { name: 'Context River' })).toBeVisible();
  await page.evaluate(() => window.highwaterHarness.recover());
  await expect(app.getByRole('alert')).toHaveCount(0);
  const other = testAnalysis();
  other.session.id = 'different-session';
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(other),
  );
  await expect(app.locator('#selected-item-summary')).toHaveCount(0);
  await expect(app.locator('#pinned-call-summary')).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Follow latest' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(app.getByRole('button', { name: 'Copy view link' })).toHaveCount(0);
});

test('Follow latest moves to the newest calls after a replacement and can be resumed after pinning', async ({
  page,
}) => {
  await open(page);
  const app = page.locator('#embed');
  const long = sessionScenario('longSession');
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(long),
  );
  const last = long.modelCalls.at(-1)!.index;
  await expect(app.getByTestId('visible-call-range')).toContainText(String(last));
  await app.getByRole('button', { name: 'Pin model call ' + last, exact: true }).focus();
  await page.keyboard.press('Enter');
  const follow = app.getByRole('button', { name: 'Follow latest' });
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(app.getByTestId('visible-call-range')).toContainText(String(last));
});

test('two views keep their DOM lookups and focus independent', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.highwaterHarness.mountSecond());
  const first = page.locator('#embed');
  const second = page.locator('#second-embed');
  await expect(second.getByRole('application', { name: 'Context River' })).toBeVisible();
  await first.getByRole('tab', { name: 'Composition' }).click();
  await page.keyboard.press('ArrowLeft');
  await expect(first.getByRole('tab', { name: 'River', exact: true })).toBeFocused();
  await second.getByRole('button', { name: 'Pin model call 1', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(second.getByRole('button', { name: 'Pin model call 2', exact: true })).toBeFocused();
  await expect(second.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await expect(first.locator('#pinned-call-summary')).toHaveCount(0);
  await page.evaluate(() => window.highwaterHarness.destroy());
  await expect(first.getByRole('application', { name: 'Context River' })).toHaveCount(0);
  await expect(second.getByRole('application', { name: 'Context River' })).toHaveCount(0);
});
