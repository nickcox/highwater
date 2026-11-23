import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { testAnalysis } from '../../src/lib/context-river/test-data';
import { toWireAnalysis } from '../../src/lib/testing/wire-analysis';
import { sessionScenario } from '../../src/lib/testing/session-scenarios';
import type {} from '../embed-harness';

const integrated = process.env.HIGHWATER_BROWSER_INTEGRATED === '1';
test.skip(integrated, 'The embed harness is a separate library consumer, served by Vite.');

async function open(
  page: Page,
  sections?: string[],
  density?: 'standard' | 'compact',
): Promise<void> {
  const bundle = await readFile(
    new URL('../../../integrations/bb/vendor/highwater-embed.js', import.meta.url),
    'utf8',
  );
  await page.route('**/embed-module.js*', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: bundle }),
  );
  await page.addInitScript(
    ({ analysis, sections, density }) => {
      window.highwaterPayload = analysis;
      if (sections) window.highwaterSections = sections as typeof window.highwaterSections;
      if (density) window.highwaterDensity = density;
    },
    { analysis: toWireAnalysis(testAnalysis()), sections, density },
  );
  await page.setViewportSize({ width: 1400, height: 1100 });
  await page.goto('/tests/embed.html');
  await expect(
    page.locator('#embed').getByRole('application', { name: 'Context River' }),
  ).toBeVisible();
  // With a call section, following pins the latest call, so only earlier calls can be stepped to.
  await expect(
    page
      .locator('#embed')
      .getByRole('button', { name: sections ? 'Previous call' : 'Next call', exact: true }),
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
  // The 420px view is compact, so the display toggles are in the View menu.
  await app.locator('summary', { hasText: 'View' }).click();
  await app.getByRole('button', { name: 'Item types', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(app.getByRole('button', { name: 'Item types', exact: true })).toBeHidden();
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
  // In the compact view this button is inside the closed More menu.
  await expect(app.locator('button[aria-label="Fit all calls"]')).toBeDisabled();
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
  const live = app.getByTitle('Live', { exact: true });
  await expect(live).toBeVisible();
  await expect(app.getByRole('status').filter({ hasText: 'Live' })).toHaveCount(1);
  await expect(app.getByTestId('visible-call-range')).toContainText(String(last));
  await app.getByRole('button', { name: 'Pin model call ' + last, exact: true }).focus();
  await page.keyboard.press('Enter');
  const follow = app.getByRole('button', { name: 'Follow latest' });
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  await expect(live).toHaveCount(0);
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(live).toBeVisible();
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

test('the panel order shows the latest call first and follows new calls until another is pinned', async ({
  page,
}) => {
  await open(page, ['summary', 'call', 'chart', 'details', 'lifespans']);
  const app = page.locator('#embed');
  const order = await app
    .locator('.exploration-grid > *')
    .evaluateAll((nodes) => nodes.map((node) => node.className.split(' ')[0]));
  expect(order).toEqual(['summary-section', 'call-section', 'panel', 'inspector-column', 'panel']);
  const heading = app.locator('#call-overview-heading');
  const follow = app.getByRole('button', { name: 'Follow latest' });
  const first = testAnalysis().modelCalls.at(-1)!.index;
  await expect(heading).toHaveText('Latest call');
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${first}`);
  await expect(follow).toHaveAttribute('aria-pressed', 'true');

  const long = sessionScenario('longSession');
  const last = long.modelCalls.at(-1)!.index;
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(long),
  );
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last}`);

  await app.getByRole('button', { name: 'Pin model call ' + last, exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last - 1}`);
  await expect(heading).toHaveText(`Call ${last - 1}`);
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(long),
  );
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last - 1}`);

  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last}`);
  await expect(heading).toHaveText('Latest call');
  const pressed = await follow.evaluate((el) => getComputedStyle(el).backgroundColor);

  // Selecting it again stops following and keeps the pinned call.
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'false');
  expect(await follow.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(pressed);
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(long),
  );
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last}`);
  await expect(heading).toHaveText(`Call ${last}`);
  await follow.click();
  await expect(follow).toHaveAttribute('aria-pressed', 'true');

  // While following, clearing removes only the selected item.
  const clearItem = app.getByRole('button', { name: 'Clear selected item', exact: true });
  await expect(clearItem).toBeDisabled();
  const largest = app.locator('.call-overview ol button').first();
  const label = await largest.textContent();
  await largest.click();
  const summary = app.locator('#selected-item-summary');
  await expect(summary).toBeFocused();
  await expect(summary).toBeInViewport();
  await expect(summary).toContainText(label!.trim());
  await clearItem.click();
  await expect(summary).toHaveCount(0);
  await expect(follow).toHaveAttribute('aria-pressed', 'true');
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last}`);
  await app.getByRole('application', { name: 'Context River' }).focus();
  await page.keyboard.press('Escape');
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last}`);

  // Without following, clearing removes the pinned call too, and new calls do not pin one.
  await follow.click();
  await app.getByRole('button', { name: 'Clear selected item and pinned call' }).click();
  await expect(app.locator('#pinned-call-summary')).toHaveCount(0);
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(long),
  );
  await expect(app.locator('#pinned-call-summary')).toHaveCount(0);

  await follow.click();
  await expect(app.locator('#pinned-call-summary')).toHaveText(`Pinned call ${last}`);
  await app.getByRole('button', { name: 'Show all in Composition' }).click();
  await expect(app.getByRole('tab', { name: 'Composition' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(app.getByRole('button', { name: 'At call', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a wide panel order keeps the details beside the chart and lifespans', async ({ page }) => {
  await open(page, ['summary', 'call', 'chart', 'details', 'lifespans']);
  const app = page.locator('#embed');
  await app.evaluate((el) => {
    el.style.width = '1300px';
  });
  await expect(app.locator('#pinned-call-summary')).toBeVisible();
  const box = async (selector: string) => (await app.locator(selector).boundingBox())!;
  const [call, chart, details, lifespans] = await Promise.all(
    ['.call-section', '.river-panel', '#inspector', '.lifespan-panel'].map(box),
  );
  expect(call.width).toBeGreaterThan(chart.width);
  expect(details.x).toBeGreaterThan(chart.x + chart.width - 1);
  expect(details.y).toBeCloseTo(chart.y, 0);
  expect(lifespans.y).toBeGreaterThan(chart.y + chart.height - 1);
  expect(chart.y).toBeGreaterThan(call.y + call.height - 1);
});

test('a narrow panel puts secondary controls in menus and starts the chart in the first screen', async ({
  page,
}) => {
  await open(page, ['summary', 'call', 'chart', 'details', 'lifespans']);
  await page.setViewportSize({ width: 460, height: 900 });
  const app = page.locator('#embed');
  await app.evaluate((el) => {
    el.style.width = '420px';
  });
  await expect(app.locator('.compact-metrics')).toBeVisible();
  const listColumns = () =>
    app
      .locator('.call-overview .lists')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(await listColumns()).toBe(1);
  await expect(app.locator('.primary-metrics')).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Chart help' })).toHaveText('?');
  await expect(app.getByRole('button', { name: 'Clear selected item' })).toHaveText('Clear');

  const fitAll = app.getByRole('button', { name: 'Fit all calls' });
  await expect(fitAll).toBeHidden();
  await app.locator('summary', { hasText: 'More' }).click();
  await expect(fitAll).toBeVisible();
  await app.getByRole('application', { name: 'Context River' }).focus();
  await page.keyboard.press('Escape');
  await expect(fitAll).toBeHidden();

  const itemTypes = app.getByRole('button', { name: 'Item types', exact: true });
  await expect(itemTypes).toBeHidden();
  await app.locator('summary', { hasText: 'View' }).click();
  await itemTypes.click();
  await expect(itemTypes).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(5, 5);
  await expect(itemTypes).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, 0));
  const chartTop = await app
    .locator('.chart-frame')
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(chartTop).toBeLessThan(900);

  // From 520px the menus return; the one-line summary stays until 760px.
  await app.evaluate((el) => {
    el.style.width = '700px';
  });
  await expect(fitAll).toBeVisible();
  await expect(app.locator('.compact-metrics')).toBeVisible();
  expect(await listColumns()).toBe(1);
  await page.setViewportSize({ width: 900, height: 900 });
  // The summary and the call overview's lists change together.
  await app.evaluate((el) => {
    el.style.width = '790px';
  });
  await page.waitForTimeout(100);
  await expect(app.locator('.compact-metrics')).toBeVisible();
  expect(await listColumns()).toBe(1);
  await app.evaluate((el) => {
    el.style.width = '840px';
  });
  await expect(app.locator('.primary-metrics')).toBeVisible();
  const figureRows = await app
    .locator('.primary-metrics > div')
    .evaluateAll((nodes) => new Set(nodes.map((node) => node.getBoundingClientRect().top)).size);
  expect(figureRows).toBe(1);
  await expect.poll(listColumns).toBe(2);
});

test('the compact bb panel uses smaller controls, List view, a lifespans filter menu and recent calls', async ({
  page,
}) => {
  await open(page, ['summary', 'call', 'chart', 'details', 'lifespans'], 'compact');
  await page.setViewportSize({ width: 460, height: 900 });
  const app = page.locator('#embed');
  await app.evaluate((el) => {
    el.style.width = '420px';
  });
  const clear = app.getByRole('button', { name: 'Clear selected item' });
  await expect(clear).toHaveText('Clear');
  expect((await clear.boundingBox())!.height).toBeLessThanOrEqual(25);
  await expect(clear).toHaveCSS('font-size', '12px');

  // Following a long session shows its recent calls, not the whole session.
  const long = sessionScenario('longSession');
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(long),
  );
  const last = long.modelCalls[long.modelCalls.length - 1].index;
  const range = app.getByTestId('visible-call-range');
  await expect(range).toContainText(`–${last} of ${long.modelCalls.length}`);
  await expect(range).not.toContainText('Calls 1–');

  await app.getByRole('tab', { name: 'Composition' }).click();
  await expect(app.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await app.getByRole('button', { name: 'Treemap', exact: true }).click();
  await expect(app.getByRole('button', { name: 'Treemap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const lifespans = app.locator('.lifespan-panel');
  await lifespans.locator('summary').first().click();
  const kind = lifespans.getByRole('combobox', { name: 'Filter by kind' });
  await expect(kind).toBeHidden();
  await lifespans.locator('summary', { hasText: 'Filter and sort' }).click();
  await expect(kind).toBeVisible();
  await kind.selectOption({ index: 1 });
  await page.keyboard.press('Escape');
  await expect(lifespans.locator('summary', { hasText: 'Filter and sort (1)' })).toBeVisible();
  const columns = await lifespans
    .locator('.row')
    .first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
});

test('a host can start the River on Visible calls, and a stored choice wins', async ({ page }) => {
  await page.addInitScript(() => {
    window.highwaterVerticalScale = 'visible';
  });
  await open(page, ['summary', 'call', 'chart', 'details', 'lifespans']);
  const app = page.locator('#embed');
  const visible = app.locator('button[aria-pressed]', { hasText: 'Visible calls' });
  await expect(visible).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() =>
    localStorage.setItem(
      'test.highwater.presentation',
      JSON.stringify({ version: 1, river: { verticalScale: 'session' } }),
    ),
  );
  await page.reload();
  await expect(app.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(app.locator('button[aria-pressed]', { hasText: 'Session scale' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('chart help in a narrow panel closes with its button, Escape or an outside click', async ({
  page,
}) => {
  await open(page, ['summary', 'call', 'chart', 'details', 'lifespans'], 'compact');
  await page.setViewportSize({ width: 1200, height: 900 });
  const app = page.locator('#embed');
  await app.evaluate((el) => {
    el.style.width = '420px';
  });
  const trigger = app.getByRole('button', { name: 'Chart help' });
  const help = app.getByRole('group', { name: 'Chart help' });
  const closeButton = app.getByRole('button', { name: 'Close help' });

  await trigger.click();
  await expect(help).toBeVisible();
  await expect(closeButton).toBeFocused();
  const panel = (await app.boundingBox())!;
  const popover = (await app.locator('.help-popover').boundingBox())!;
  expect(popover.x).toBeGreaterThanOrEqual(panel.x);
  expect(popover.x + popover.width).toBeLessThanOrEqual(panel.x + panel.width);
  await closeButton.click();
  await expect(help).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await app.getByRole('tab', { name: 'River', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();

  await trigger.click();
  await page.mouse.click(panel.x + panel.width + 100, 400);
  await expect(help).toBeHidden();
});

test('legends stay in view while a zoomed chart is scrolled to recent calls', async ({ page }) => {
  await open(page, ['summary', 'call', 'chart', 'details', 'lifespans'], 'compact');
  await page.setViewportSize({ width: 460, height: 900 });
  const app = page.locator('#embed');
  await app.evaluate((el) => {
    el.style.width = '420px';
  });
  // Reported input on every call gives the input reference legend something to compare.
  const long = sessionScenario('longSession');
  for (const call of long.modelCalls) {
    call.reportedPromptTokens = (call.tokenAnalysis.calculatedVisibleTokens ?? 0) + 1000;
    call.reportedUsageCompleteness = 'complete';
    call.usage = { ...call.usage, input: call.reportedPromptTokens, cacheRead: 0, cacheWrite: 0 };
  }
  await page.evaluate(
    (analysis) => window.highwaterHarness.replace(analysis),
    toWireAnalysis(long),
  );
  const scroller = app.locator('.river-scroll');
  // Following a long session zooms to its recent calls, scrolled to the right.
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  const inView = async (selector: string) => {
    const area = (await scroller.boundingBox())!;
    const legend = (await app.locator(selector).boundingBox())!;
    return legend.x >= area.x - 1 && legend.x + legend.width <= area.x + area.width + 1;
  };
  await expect(app.locator('.input-reference-legend')).toBeVisible();
  expect(await inView('.input-reference-legend')).toBe(true);
  await app.locator('summary', { hasText: 'View' }).click();
  await app.getByRole('button', { name: 'Item types', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(app.locator('.group-type-legend')).toBeVisible();
  expect(await inView('.group-type-legend')).toBe(true);
});
