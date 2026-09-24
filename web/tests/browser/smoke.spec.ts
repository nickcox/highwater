import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { testAnalysis } from '../../src/lib/context-river/test-data';
import { sessionScenario } from '../../src/lib/testing/session-scenarios';

const integrated = process.env.TOKENPLUME_BROWSER_INTEGRATED === '1';
const generation = '0123456789abcdef0123456789abcdef';

async function mockApi(page: Page, sourceAnalysis = testAnalysis()): Promise<void> {
  await page.addInitScript((liveGeneration: string) => {
    class StableEventSource extends EventTarget {
      readonly url: string;
      readonly withCredentials = false;
      private state = 0;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        queueMicrotask(() => {
          if (this.state === 2) return;
          this.state = 1;
          this.onopen?.(new Event('open'));
          this.dispatchEvent(
            new MessageEvent('liveStatus', {
              data: JSON.stringify({ generation: liveGeneration, availability: 'active' }),
            }),
          );
        });
      }

      get readyState(): number {
        return this.state;
      }
      close(): void {
        this.state = 2;
      }
    }

    (window as unknown as { EventSource: typeof EventSource }).EventSource =
      StableEventSource as unknown as typeof EventSource;
  }, generation);

  const analysis = structuredClone(sourceAnalysis);
  analysis.session.id = 'browser-smoke';

  await page.route('**/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        etag: '"catalog-v0"',
        'X-TokenPlume-Server-Generation': generation,
        'X-TokenPlume-Catalog-Revision': '0',
        'X-TokenPlume-Live-Updates': 'active',
      },
      body: JSON.stringify({
        sessions: [
          {
            id: 'browser-smoke',
            fileName: 'browser-smoke.jsonl',
            displayName: 'Sanitized browser smoke fixture',
            workingDirectory: '/tmp/tokenplume-browser-smoke',
            startedAt: null,
            byteSize: 1,
            modifiedAt: null,
          },
        ],
      }),
    });
  });

  await page.route('**/api/sessions/**/analysis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { etag: '"analysis-v0"' },
      body: JSON.stringify(analysis),
    });
  });
}

async function assertLoaded(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'TokenPlume' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page.locator('header select')).toHaveValue(integrated ? /.+/ : 'browser-smoke');
}

test('mocked app loads a session, selects an item, and navigates the chart', async ({ page }) => {
  test.skip(integrated, 'This test uses deterministic mocked API responses.');
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.getByTestId('live-status')).toHaveText('Live updates: live');

  const screenshotDirectory = process.env.TOKENPLUME_BASELINE_SCREENSHOTS;
  if (screenshotDirectory) {
    const output = resolve(screenshotDirectory);
    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
    await page.screenshot({ path: resolve(output, 'narrow.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  const item = page
    .getByRole('application', { name: 'Context River' })
    .getByRole('button', { name: 'bash: npm test' });
  await expect(item).toBeVisible();
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Selected item')).toBeVisible();
  await expect(page.locator('.ribbon-group.selected')).toHaveCount(1);
  await expect(page.locator('.ribbon-group.related, .ribbon-group.dimmed')).toHaveCount(0);
  const otherRibbon = page.locator('.ribbon-group:not(.selected)').first();
  await expect
    .poll(() => otherRibbon.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('0.88');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  expect(pageErrors).toEqual([]);
});

test('chart gestures finish outside the plot and cancel on pointercancel or window blur', async ({
  page,
}) => {
  test.skip(integrated, 'This gesture regression uses deterministic mocked API responses.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);

  const host = page.getByTestId('river-host');
  const bounds = await host.boundingBox();
  expect(bounds).not.toBeNull();
  const chart = bounds!;
  const y = chart.y + Math.min(90, chart.height / 3);
  const startX = chart.x + chart.width * 0.42;
  const endX = chart.x + chart.width * 0.55;
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  const outsideX = Math.min(viewportWidth - 8, chart.x + chart.width + 32);

  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 4 });
  await expect(page.locator('.zoom-selection')).toBeVisible();
  await page.mouse.move(outsideX, y, { steps: 2 });
  await page.mouse.up();
  await expect(page.locator('.zoom-selection')).toHaveCount(0);
  await expect(page.locator('.zoom-level')).not.toHaveText('Zoom 1.0×');

  await page.getByRole('button', { name: 'Fit all calls' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 4 });
  await expect(page.locator('.zoom-selection')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent('pointercancel', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
      }),
    );
  });
  await expect(page.locator('.zoom-selection')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');

  await page.getByRole('button', { name: 'Zoom in' }).click();
  const beforePan = await host.evaluate((element) => element.scrollLeft);
  const panFromX = beforePan > 0 ? startX : endX;
  const panToX = beforePan > 0 ? endX : startX;
  await page.keyboard.down('Shift');
  await page.mouse.move(panFromX, y);
  await page.mouse.down();
  await page.mouse.move(panToX, y, { steps: 3 });
  const scrollAtBlur = await host.evaluate((element) => element.scrollLeft);
  expect(scrollAtBlur).not.toBe(beforePan);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.move(panFromX, y, { steps: 3 });
  await expect.poll(() => host.evaluate((element) => element.scrollLeft)).toBe(scrollAtBlur);
  await page.mouse.up();
  await page.keyboard.up('Shift');
});

test('vertical scale controls explain local ribbon heights and keep the axis anchored while panning', async ({
  page,
}) => {
  test.skip(integrated, 'This scale regression uses deterministic long-session data.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);

  const host = page.getByTestId('river-host');
  const axis = page.locator('.vertical-axis-overlay');
  const axisBefore = await axis.boundingBox();
  expect(axisBefore).not.toBeNull();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Latest' }).click();
  await expect.poll(() => host.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const axisAfter = await axis.boundingBox();
  expect(axisAfter).not.toBeNull();
  expect(Math.abs(axisAfter!.x - axisBefore!.x)).toBeLessThan(1);

  await page.getByRole('button', { name: 'Visible calls' }).click();
  await expect(page.getByRole('button', { name: 'Visible calls' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.scale-description')).toContainText(/ribbon heights change/i);
  await expect(axis).toHaveAttribute('aria-label', /estimated tokens/);
  const tickPositions = await page.locator('.vertical-axis-tick').evaluateAll((elements) =>
    elements
      .map((element) => ({
        value: Number(element.textContent),
        y: element.getBoundingClientRect().top,
      }))
      .sort((left, right) => left.value - right.value),
  );
  for (let index = 1; index < tickPositions.length; index += 1) {
    expect(tickPositions[index]!.value).toBeGreaterThan(tickPositions[index - 1]!.value);
    expect(tickPositions[index]!.y).toBeLessThan(tickPositions[index - 1]!.y);
    expect(tickPositions[index - 1]!.y - tickPositions[index]!.y).toBeGreaterThan(12);
  }
  const scaleScreenshotDirectory = process.env.TOKENPLUME_SCALE_SCREENSHOTS;
  if (scaleScreenshotDirectory) {
    const output = resolve(scaleScreenshotDirectory);
    mkdirSync(output, { recursive: true });
    await page.screenshot({
      path: resolve(output, 'visible-scale-long-session.png'),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Visible calls' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Session scale' }).click();
  await expect(page.getByRole('button', { name: 'Session scale' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('navigation controls keep their slot when the visible-range status changes', async ({
  page,
}) => {
  test.skip(integrated, 'This navigation-layout regression uses deterministic long-session data.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);

  const range = page.getByTestId('visible-call-range');
  const controls = page.locator('.viewport-navigation .controls');
  async function zoomAndCheckStablePosition(): Promise<void> {
    const beforeRange = await range.textContent();
    const before = await controls.boundingBox();
    expect(before).not.toBeNull();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(range).not.toHaveText(beforeRange ?? '');
    const after = await controls.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  }

  await zoomAndCheckStablePosition();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fit all calls' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  await zoomAndCheckStablePosition();
});

test('source labels lead while bounded previews remain separate escaped text', async ({ page }) => {
  test.skip(integrated, 'This regression uses deterministic mocked API data.');
  const analysis = testAnalysis();
  const item = analysis.contextItems.find((candidate) => candidate.id === 'a')!;
  const previewText = 'file excerpt <img src=x onerror=alert(1)>';
  item.label = `Read · ${'界'.repeat(80)}`;
  item.preview = {
    text: previewText,
    kind: 'text',
    truncated: true,
    expandedText: `${previewText} expanded`,
    expandedTruncated: false,
  };
  await mockApi(page, analysis);
  await page.goto('/');
  await assertLoaded(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const chart = page.getByRole('application', { name: 'Context River' });
  const ribbon = chart.getByRole('button', { name: item.label, exact: true });
  await expect(ribbon).toBeVisible();
  await ribbon.click();
  await expect(page.getByRole('heading', { name: item.label, exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(page.locator('.item-details .content-preview')).toContainText(previewText);
  const previewDetails = page.locator('.preview-details');
  await expect(previewDetails).not.toHaveAttribute('open', '');
  await expect(previewDetails.locator('pre')).not.toBeVisible();
  await previewDetails.locator('summary').press('Enter');
  await expect(previewDetails).toHaveAttribute('open', '');
  await expect(previewDetails.locator('pre')).toContainText(`${previewText} expanded`);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});

test('range zoom keeps every requested marker visible at desktop, narrow, and resized widths', async ({
  page,
}) => {
  test.skip(integrated, 'This regression uses the deterministic long-session API fixture.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.getByTestId('visible-call-range')).toContainText('160');

  const chart = page.getByRole('application', { name: 'Context River' });
  const host = page.getByTestId('river-host');
  async function expectMarkersInsideViewport(start: number, end: number): Promise<void> {
    const calls = [...new Set([start, end])];
    for (const call of calls) {
      await expect(
        chart.getByRole('button', { name: `Pin model call ${call}`, exact: true }),
      ).toBeVisible();
    }
    const bounds = await host.evaluate((element, callIndices) => {
      const hostRect = element.getBoundingClientRect();
      return callIndices.map((callIndex) => {
        const marker = element.querySelector(`[aria-label="Pin model call ${callIndex}"]`);
        const rect = marker?.getBoundingClientRect();
        return {
          callIndex,
          left: rect?.left ?? null,
          right: rect?.right ?? null,
          hostLeft: hostRect.left,
          hostRight: hostRect.right,
        };
      });
    }, calls);
    expect(
      bounds.filter(
        (bound) =>
          bound.left === null ||
          bound.left < bound.hostLeft - 1 ||
          bound.right === null ||
          bound.right > bound.hostRight + 1,
      ),
    ).toEqual([]);
  }

  async function zoomRange(start: number, end: number): Promise<void> {
    await page.locator('.go-to-disclosure summary').click();
    await page.getByLabel('Range start call').fill(String(start));
    await page.getByLabel('Range end call').fill(String(end));
    await page.getByRole('button', { name: 'Zoom to range' }).click();
    await expectMarkersInsideViewport(Math.min(start, end), Math.max(start, end));
  }

  await zoomRange(80, 81);
  await zoomRange(80, 82);
  await zoomRange(79, 82);
  await zoomRange(82, 80);
  await zoomRange(1, 2);
  await zoomRange(159, 160);
  await zoomRange(81, 81);

  async function settleChartWidth(narrow: boolean): Promise<void> {
    await page.waitForFunction((isNarrow) => {
      const currentHost = document.querySelector('[data-testid="river-host"]');
      if (!currentHost) return false;
      return isNarrow
        ? currentHost.clientWidth > 200 && currentHost.clientWidth < 400
        : currentHost.clientWidth > 650;
    }, narrow);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
  }

  await page.getByRole('button', { name: 'Fit all calls' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await settleChartWidth(true);
  await zoomRange(80, 81);
  await page.setViewportSize({ width: 1280, height: 900 });
  await settleChartWidth(false);
  await expectMarkersInsideViewport(80, 81);
});

test('native disclosures, Escape navigation, and exact-item emphasis work in a browser', async ({
  page,
}) => {
  test.skip(integrated, 'This interaction regression uses deterministic mocked API data.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);

  const sessionDetails = page.locator('.session-details');
  await expect(sessionDetails).not.toHaveAttribute('open', '');
  await expect(sessionDetails.getByRole('heading', { name: 'Usage breakdown' })).not.toBeVisible();
  await sessionDetails.locator('summary').press('Enter');
  await expect(sessionDetails).toHaveAttribute('open', '');
  await expect(sessionDetails.getByRole('heading', { name: 'Usage breakdown' })).toBeVisible();
  await sessionDetails.locator('summary').press('Enter');
  await expect(sessionDetails).not.toHaveAttribute('open', '');

  const chart = page.getByRole('application', { name: 'Context River' });
  await chart.getByRole('button', { name: 'bash: npm test' }).click();
  await expect(page.getByText('Selected item')).toBeVisible();
  await expect(page.getByText('4 of 4 items', { exact: true })).toBeVisible();
  await expect(page.locator('.ribbon-group.selected')).toHaveCount(1);
  await expect(page.locator('.ribbon-group.related, .ribbon-group.dimmed')).toHaveCount(0);
  await expect(page.locator('.lineage-connector.visible')).toHaveCount(1);

  const goTo = page.locator('.go-to-disclosure');
  const goToSummary = goTo.locator('summary');
  await goToSummary.press('Enter');
  await expect(goTo).toHaveAttribute('open', '');
  const callInput = page.getByLabel('Call number');
  await expect(callInput).toBeVisible();
  await callInput.press('Escape');
  await expect(goTo).not.toHaveAttribute('open', '');
  await expect(goToSummary).toBeFocused();
  await expect(page.getByText('Selected item')).toBeVisible();

  await page.getByRole('button', { name: 'Pin model call 1' }).click();
  const callDetails = page.locator('.call-details');
  const usage = callDetails.locator('.usage-breakdown');
  await expect(usage).not.toHaveAttribute('open', '');
  await expect(usage.getByText('Fresh input')).not.toBeVisible();
  await usage.locator('summary').press('Enter');
  await expect(usage).toHaveAttribute('open', '');
  await expect(usage.getByText('Fresh input')).toBeVisible();
});

test('wide exploration keeps a bounded sticky inspector beside the chart', async ({ page }) => {
  test.skip(integrated, 'This workspace layout regression uses deterministic mocked API data.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);

  const chart = page.locator('.river-panel');
  const inspector = page.locator('.inspector-column');
  const lifespans = page.locator('.lifespan-panel');
  const [chartBounds, inspectorBounds, lifespanBounds] = await Promise.all([
    chart.boundingBox(),
    inspector.boundingBox(),
    lifespans.boundingBox(),
  ]);
  expect(chartBounds).not.toBeNull();
  expect(inspectorBounds).not.toBeNull();
  expect(lifespanBounds).not.toBeNull();
  expect(inspectorBounds!.x).toBeGreaterThanOrEqual(chartBounds!.x + chartBounds!.width);
  expect(lifespanBounds!.y).toBeGreaterThanOrEqual(chartBounds!.y + chartBounds!.height);
  expect(await inspector.evaluate((element) => getComputedStyle(element).maxHeight)).toBe('868px');

  await page.evaluate(() => window.scrollTo(0, 320));
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const stickyTop = await inspector.evaluate((element) => element.getBoundingClientRect().top);
  expect(stickyTop).toBeGreaterThanOrEqual(12);
  expect(stickyTop).toBeLessThanOrEqual(20);
});

test('hover previews are measured and clamped at viewport edges', async ({ page }) => {
  test.skip(integrated, 'This hover-layout regression uses deterministic mocked API data.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);

  const hit = page
    .getByRole('application', { name: 'Context River' })
    .locator('.ribbon-hit')
    .first();
  const card = page.locator('.item-hover-card');

  for (const point of [
    { x: 1278, y: 898 },
    { x: 1, y: 1 },
  ]) {
    await hit.evaluate((element, clientPoint) => {
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: clientPoint.x,
          clientY: clientPoint.y,
        }),
      );
    }, point);
    await expect(card).toBeVisible();
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(8);
    expect(bounds!.y).toBeGreaterThanOrEqual(8);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1272);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(892);
  }
});

test('narrow workspace provides deliberate View details navigation', async ({ page }) => {
  test.skip(
    integrated,
    'This responsive navigation regression uses deterministic mocked API data.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);

  const link = page.getByRole('link', { name: 'View details' }).first();
  await expect(link).toBeVisible();
  await link.click();
  const inspector = page.locator('#inspector');
  await expect(inspector).toBeFocused();
  await expect(inspector).toBeInViewport();
});

test('terminal summaries without calls remain selectable from the lifespan list', async ({
  page,
}) => {
  test.skip(integrated, 'This regression uses a deterministic terminal-summary fixture.');
  await mockApi(page, sessionScenario('terminalSummaryOnly'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TokenPlume' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No model calls' })).toBeVisible();
  await expect(page.getByText('1 of 1 items')).toBeVisible();
  await expect(page.getByRole('application', { name: 'Context River' })).toHaveCount(0);

  await page
    .getByRole('button', {
      name: 'Select Terminal compaction summary; no model-call presence',
    })
    .click();
  await expect(page.getByRole('heading', { name: 'Terminal compaction summary' })).toBeVisible();
  await expect(page.locator('.item-details')).toContainText('No model-call presence');
});

test('integrated Rust-served embedded app loads, selects, and navigates', async ({ page }) => {
  test.skip(!integrated, 'Run scripts/browser-smoke-integrated.sh for the embedded-server smoke.');
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('/');
  await assertLoaded(page);
  const chart = page.getByRole('application', { name: 'Context River' });
  await expect(page.getByTestId('visible-call-range')).toContainText('of');
  const ribbon = chart.locator('.ribbon-hit').first();
  await expect(ribbon).toBeVisible();
  await ribbon.click();
  await expect(ribbon).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Selected item')).toBeVisible();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  expect(pageErrors).toEqual([]);
});
