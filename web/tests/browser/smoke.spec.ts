import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { costAssessmentOf, testAnalysis } from '../../src/lib/context-river/test-data';
import type { SessionAnalysis, WireSessionAnalysis } from '../../src/lib/types';
import { toWireAnalysis } from '../../src/lib/testing/wire-analysis';
import { ITEM_TYPE_PALETTE } from '../../src/lib/context-river/colors';
import { compositionScenario } from '../../src/lib/testing/composition-scenarios';
import { sessionScenario } from '../../src/lib/testing/session-scenarios';

const integrated = process.env.TOKENPLUME_BROWSER_INTEGRATED === '1';
const generation = '0123456789abcdef0123456789abcdef';
const failedUsageExport = JSON.parse(
  readFileSync(new URL('../../../fixtures/analysis/failed-usage.json', import.meta.url), 'utf8'),
) as WireSessionAnalysis;

function economicsScenario(): ReturnType<typeof testAnalysis> {
  const analysis = testAnalysis();
  for (const call of analysis.modelCalls) {
    const input = call.index === 1 ? 750 : 1000;
    const cacheRead = call.index === 1 ? 250 : 0;
    const cacheWrite = 0;
    const promptTokens = input + cacheRead + cacheWrite;
    const piPromptCost = 0.0000000123 * call.index;
    call.provider = 'anthropic';
    call.api = 'anthropic-messages';
    call.usage = { ...call.usage, input, cacheRead, cacheWrite };
    call.cost = {
      input: piPromptCost,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: piPromptCost,
    };
    call.costAssessment = costAssessmentOf('recorded', piPromptCost);
    call.economics = {
      ...call.economics,
      policyId: 'anthropic-messages-cache-v1',
      usageCompleteness: 'complete',
      costCompleteness: 'complete',
      cacheWriteStatus: 'reported',
      promptTokens,
      cacheReadRatio: cacheRead / promptTokens,
      cacheWriteRatio: 0,
      freshRatio: input / promptTokens,
      piPromptCost,
      cacheRatioDiscontinuity: null,
      explanationCodes: [],
    };
  }
  analysis.modelCalls[3].model = 'different-model';
  analysis.modelCalls[1].economics.cacheRatioDiscontinuity = {
    previousCallIndex: 1,
    direction: 'drop',
    previousRatio: 0.25,
    currentRatio: 0,
    delta: 0.25,
    magnitude: 'notable',
    method: 'adjacent-cache-read-share-v1',
    previousPromptTokens: 1000,
    currentPromptTokens: 1000,
    compactionBefore: analysis.modelCalls[1].compactionBefore,
  };
  analysis.economics = {
    ...analysis.economics,
    supportedPolicyIds: ['anthropic-messages-cache-v1'],
    usageCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
    costCompleteness: { complete: 4, partial: 0, missing: 0, unsupported: 0 },
    cacheReadEligibleCalls: 4,
    cacheReadPromptTokens: 4000,
    cacheReadTokens: 250,
    cacheReadRatio: 0.0625,
    explanationCodes: [],
  };
  return analysis;
}

function clusteredEconomicsScenario(): ReturnType<typeof testAnalysis> {
  const analysis = economicsScenario();
  const template = analysis.modelCalls[0];
  const callCount = 180;
  analysis.modelCalls = Array.from({ length: callCount }, (_, position) => {
    const index = position + 1;
    const zeroPrompt = index === 170;
    const hasCacheRead = index !== 160 && !zeroPrompt;
    const input = zeroPrompt ? 0 : hasCacheRead ? 1000 : 2000;
    const cacheRead = hasCacheRead ? 1000 : 0;
    return {
      ...structuredClone(template),
      index,
      sourceRecordId: `clustered-call-${index}`,
      model: index === 161 ? 'changed-model' : 'm',
      contextItemIds: [...template.contextItemIds],
      addedItemIds: index === 1 ? [...template.contextItemIds] : [],
      droppedItemIds: [],
      transitionItemCounts: {
        added: index === 1 ? template.contextItemIds.length : 0,
        retained: index === 1 ? 0 : template.contextItemIds.length,
        dropped: 0,
      },
      usage: { ...template.usage, input, cacheRead, cacheWrite: 0 },
      economics: {
        ...template.economics,
        promptTokens: zeroPrompt ? 0 : 2000,
        cacheReadRatio: zeroPrompt ? null : hasCacheRead ? 0.5 : 0,
        cacheWriteRatio: zeroPrompt ? null : 0,
        freshRatio: zeroPrompt ? null : hasCacheRead ? 0.5 : 1,
        cacheRatioDiscontinuity:
          index === 160
            ? {
                previousCallIndex: 159,
                direction: 'drop',
                previousRatio: 0.5,
                currentRatio: 0,
                delta: 0.5,
                magnitude: 'large' as const,
                method: 'adjacent-cache-read-share-v1' as const,
                previousPromptTokens: 2000,
                currentPromptTokens: 2000,
                compactionBefore: null,
              }
            : null,
      },
    };
  });
  analysis.contextItems = analysis.contextItems
    .filter((item) => template.contextItemIds.includes(item.id))
    .map((item) => ({
      ...item,
      firstModelCall: 1,
      lastModelCall: callCount,
      presence: [{ startCall: 1, endCall: callCount }],
      presenceCallCount: callCount,
    }));
  analysis.compactions = [];
  analysis.lineage = [];
  analysis.economics = {
    ...analysis.economics,
    usageCompleteness: { complete: callCount, partial: 0, missing: 0, unsupported: 0 },
    costCompleteness: { complete: callCount, partial: 0, missing: 0, unsupported: 0 },
    cacheReadEligibleCalls: callCount,
    cacheReadPromptTokens: (callCount - 2) * 2000,
    cacheReadTokens: (callCount - 2) * 1000,
    cacheReadRatio: 0.5,
  };
  return analysis;
}

function denseEconomicsScenario(): ReturnType<typeof testAnalysis> {
  const analysis = economicsScenario();
  const callCount = 1000;
  const itemCount = 2000;
  const templateCall = analysis.modelCalls[0];
  const templateItem = analysis.contextItems[0];
  const coreItemIds = Array.from({ length: 1000 }, (_, index) => `dense-item-${index}`);
  const earlyItemIds = Array.from({ length: 500 }, (_, index) => `dense-item-${index + 1000}`);
  const lateItemIds = Array.from({ length: 500 }, (_, index) => `dense-item-${index + 1500}`);
  const itemIdsForCall = (index: number): string[] => [
    ...coreItemIds,
    ...(index <= 500 ? earlyItemIds : lateItemIds),
  ];
  const kinds: Array<(typeof templateItem)['kind']> = [
    'toolResult',
    'userMessage',
    'assistantMessage',
    'customMessage',
    'system',
    'toolDefinition',
  ];
  analysis.contextItems = Array.from({ length: itemCount }, (_, index) => {
    const startCall = index < 1000 ? 1 : index < 1500 ? 1 : 501;
    const endCall = index < 1000 ? callCount : index < 1500 ? 500 : callCount;
    const tokens = 16 + (index % 31);
    const presenceCallCount = endCall - startCall + 1;
    return {
      ...structuredClone(templateItem),
      id: `dense-item-${index}`,
      label: `Sanitized dense item ${String(index).padStart(4, '0')} · ${index % 2 ? 'long sibling label' : 'compact label'}`,
      kind: kinds[index % kinds.length],
      sourceRecordId: `dense-item-record-${index}`,
      firstModelCall: startCall,
      lastModelCall: endCall,
      ageAtFinalModelCall: callCount - endCall,
      displayWeight: tokens,
      presence: [{ startCall, endCall }],
      presenceCallCount,
      metadata: { source: 'sanitized-dense-fixture' },
      tokenEstimates: [{ ...templateItem.tokenEstimates[0], tokens }],
      tokenTurns: tokens * presenceCallCount,
      tokenTurnsCoverage: {
        completeItems: 1,
        partialItems: 0,
        unavailableItems: 0,
        totalItems: 1,
        coveredCalls: presenceCallCount,
        totalCalls: presenceCallCount,
      },
    };
  });
  analysis.modelCalls = Array.from({ length: callCount }, (_, position) => {
    const index = position + 1;
    const contextItemIds = itemIdsForCall(index);
    const previousIds = position === 0 ? [] : itemIdsForCall(index - 1);
    const addedItemIds = contextItemIds.filter((id) => !previousIds.includes(id));
    const droppedItemIds = previousIds.filter((id) => !contextItemIds.includes(id));
    const ratio = index >= 120 && index <= 240 ? (index % 2 === 0 ? 0.1 : 0.5) : 0.5;
    const previousRatio =
      index > 1
        ? index - 1 >= 120 && index - 1 <= 240
          ? (index - 1) % 2 === 0
            ? 0.1
            : 0.5
          : 0.5
        : ratio;
    const promptTokens = 2000;
    const cacheRead = Math.round(promptTokens * ratio);
    const previousPromptTokens = promptTokens;
    return {
      ...structuredClone(templateCall),
      index,
      sourceRecordId: `dense-call-${index}`,
      provider: 'anthropic',
      model: `dense-model-${Math.floor((index - 1) / 250)}`,
      api: 'anthropic-messages',
      contextItemIds,
      addedItemIds,
      droppedItemIds,
      transitionItemCounts: {
        added: addedItemIds.length,
        retained: contextItemIds.length - addedItemIds.length,
        dropped: droppedItemIds.length,
      },
      usage: { ...templateCall.usage, input: promptTokens - cacheRead, cacheRead, cacheWrite: 0 },
      cost: {
        input: index * 0.000000001,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: index * 0.000000001,
      },
      economics: {
        ...templateCall.economics,
        policyId: 'anthropic-messages-cache-v1',
        usageCompleteness: 'complete',
        costCompleteness: 'complete',
        cacheWriteStatus: 'reported',
        promptTokens,
        cacheReadRatio: ratio,
        cacheWriteRatio: 0,
        freshRatio: 1 - ratio,
        piPromptCost: index * 0.000000001,
        cacheRatioDiscontinuity:
          index > 1 && ratio !== previousRatio
            ? {
                previousCallIndex: index - 1,
                direction: ratio < previousRatio ? 'drop' : 'rise',
                previousRatio,
                currentRatio: ratio,
                delta: Math.abs(ratio - previousRatio),
                magnitude: 'notable' as const,
                method: 'adjacent-cache-read-share-v1' as const,
                previousPromptTokens,
                currentPromptTokens: promptTokens,
                compactionBefore: null,
              }
            : null,
        explanationCodes: [],
      },
    };
  });
  const compactionBoundaries = [1, 101, 301, 501, 701, 1000];
  analysis.compactions = compactionBoundaries.map((beforeModelCall, position) => ({
    id: `dense-compaction-${position}`,
    beforeModelCall,
    sourceItemIds: [`dense-item-${position + 5}`],
    retainedItemIds: [`dense-item-${position + 6}`],
    summaryItemId: `dense-item-${position + 7}`,
    tokensBefore: 400 + position,
  }));
  analysis.lineage = [];
  const cacheReadTokens = analysis.modelCalls.reduce(
    (total, call) => total + (call.usage.cacheRead ?? 0),
    0,
  );
  analysis.economics = {
    ...analysis.economics,
    supportedPolicyIds: ['anthropic-messages-cache-v1'],
    usageCompleteness: { complete: callCount, partial: 0, missing: 0, unsupported: 0 },
    costCompleteness: { complete: callCount, partial: 0, missing: 0, unsupported: 0 },
    cacheReadEligibleCalls: callCount,
    cacheReadPromptTokens: callCount * 2000,
    cacheReadTokens,
    cacheReadRatio: cacheReadTokens / (callCount * 2000),
    explanationCodes: [],
  };
  analysis.tokenAnalysis.itemEstimateCoverage = {
    completeItems: itemCount,
    partialItems: 0,
    unavailableItems: 0,
    totalItems: itemCount,
    coveredCalls: itemCount,
    totalCalls: itemCount,
  };
  analysis.tokenAnalysis.totalCalculatedTokenTurns = analysis.contextItems.reduce(
    (total, item) => total + item.tokenTurns,
    0,
  );
  analysis.tokenAnalysis.totalTokenTurnsCoverage = analysis.tokenAnalysis.itemEstimateCoverage;
  analysis.session.calculatedTokenTurns = analysis.tokenAnalysis.totalCalculatedTokenTurns;
  analysis.session.calculatedTokenTurnsCoverage = analysis.tokenAnalysis.itemEstimateCoverage;
  return analysis;
}

async function mockApi(
  page: Page,
  sourceAnalysis: SessionAnalysis | WireSessionAnalysis = testAnalysis(),
): Promise<void> {
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
      body: JSON.stringify(toWireAnalysis(analysis)),
    });
  });
}

async function assertLoaded(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'TokenPlume' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Session' })).toHaveValue(
    integrated ? /.+/ : 'browser-smoke',
  );
}

async function expandEconomics(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Cache & cost', exact: true });
  if ((await trigger.count()) && (await trigger.getAttribute('aria-expanded')) === 'false')
    await trigger.click();
}
async function openViewOptions(page: Page): Promise<void> {
  const options = page.locator('.view-options');
  if (!(await options.evaluate((node) => (node as HTMLDetailsElement).open)))
    await options.locator('summary').click();
}

async function restoreRiverRange(page: Page, start: number, end: number): Promise<void> {
  const bounds = [Math.min(start, end), Math.max(start, end)];
  await page.evaluate(([from, to]) => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set('session', 'browser-smoke');
    params.set('range', `${from}:${to}`);
    window.location.hash = params.toString();
  }, bounds);
  await page.waitForFunction(([from, to]) => {
    const host = document.querySelector('[data-testid="river-host"]');
    if (!host) return false;
    const box = host.getBoundingClientRect();
    return [from, to].every((index) => {
      const marker = host.querySelector(`[aria-label="Pin model call ${index}"]`);
      const rect = marker?.getBoundingClientRect();
      return rect && rect.left >= box.left - 1 && rect.right <= box.right + 1;
    });
  }, bounds);
}

async function captureBaselineState(page: Page, directory: string, name: string): Promise<void> {
  const output = resolve(directory);
  mkdirSync(output, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  await page.screenshot({ path: resolve(output, `${name}.viewport.png`) });
  const metrics = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      deviceScaleFactor: window.devicePixelRatio,
      fixture: 'sanitized browser smoke fixture',
      scrollY: window.scrollY,
      chartArea: bounds('.chart-area'),
      scaleControls: bounds('.vertical-scale-controls'),
      plot: bounds('.plot-background'),
      riverSurface: bounds('.river-scroll'),
      navigation: bounds('.viewport-navigation'),
      workspace: bounds('.exploration-grid'),
      documentHeight: document.documentElement.scrollHeight,
    };
  });
  writeFileSync(resolve(output, `${name}.metrics.json`), `${JSON.stringify(metrics, null, 2)}\n`);
}

test('keyboard Retry recovers an analysis failure without switching sessions', async ({ page }) => {
  test.skip(integrated, 'Recovery uses deterministic mocked responses.');
  await mockApi(page);
  let fail = true;
  await page.route('**/api/sessions/**/analysis', async (route) => {
    if (!fail) return route.fallback();
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Temporary analysis failure' } }),
    });
  });
  await page.goto('/');
  const retry = page.getByRole('button', { name: 'Retry', exact: true });
  await expect(retry).toBeVisible();
  fail = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await assertLoaded(page);
  await expect(retry).toHaveCount(0);
});

test('session picker controls align on desktop and wrap cleanly on narrow screens', async ({
  page,
}) => {
  test.skip(integrated, 'Mocked API only.');
  await mockApi(page);
  await page.goto('/');
  const harness = page.getByRole('combobox', { name: 'Harness' });
  const search = page.getByRole('searchbox', { name: 'Search sessions' });
  const session = page.getByRole('combobox', { name: 'Session' });
  await expect(session).toBeVisible();
  const controls = [harness, search, session];
  const desktop = await Promise.all(controls.map((control) => control.boundingBox()));
  for (const bounds of desktop) {
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBe(36);
    expect(bounds!.y).toBe(desktop[0]!.y);
  }
  const appearance = await Promise.all(
    controls.map((control) =>
      control.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.padding, style.borderRadius, style.fontSize, style.backgroundColor];
      }),
    ),
  );
  expect(appearance[1]).toEqual(appearance[0]);
  expect(appearance[2]).toEqual(appearance[0]);
  await search.focus();
  expect(await search.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');

  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await Promise.all(controls.map((control) => control.boundingBox()));
  expect(narrow[1]!.y).toBe(narrow[0]!.y);
  expect(narrow[2]!.y).toBeGreaterThan(narrow[0]!.y + narrow[0]!.height);
  for (const bounds of narrow) {
    expect(bounds!.height).toBe(36);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
});

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
    for (const width of [1440, 1280, 1100]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
      await captureBaselineState(page, screenshotDirectory, `${width}-empty-inspector`);
    }
    await captureBaselineState(page, screenshotDirectory, 'desktop-empty-inspector');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
    await captureBaselineState(page, screenshotDirectory, 'narrow-empty-inspector');
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  const item = page
    .getByRole('application', { name: 'Context River' })
    .getByRole('button', { name: 'bash: npm test' });
  await expect(item).toBeVisible();
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();
  await expect(page.locator('.ribbon-group.selected')).toHaveCount(1);
  await expect(page.locator('.ribbon-group.related, .ribbon-group.dimmed')).toHaveCount(0);
  if (screenshotDirectory) {
    await page.getByRole('button', { name: 'Pin model call 1' }).click();
    await expect(page.getByText('Pinned call 1')).toBeVisible();
    await captureBaselineState(page, screenshotDirectory, 'desktop-selected-pinned');
    const sessionDetails = page.locator('.session-details');
    await sessionDetails.locator('summary').click();
    await expect(sessionDetails).toHaveAttribute('open', '');
    await captureBaselineState(page, screenshotDirectory, 'desktop-session-details-expanded');
    await page.setViewportSize({ width: 390, height: 844 });
    await captureBaselineState(page, screenshotDirectory, 'narrow-selected-pinned');
  }
  // Selection never dims other ribbons; they keep their normal fill opacity.
  const otherRibbon = page.locator('.ribbon-group:not(.selected)').first();
  await expect
    .poll(() => otherRibbon.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('1');
  await expect
    .poll(() =>
      otherRibbon.locator('.ribbon').evaluate((element) => getComputedStyle(element).fillOpacity),
    )
    .toBe('0.88');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  expect(pageErrors).toEqual([]);
});

test('River ribbon activation pins first inclusion and explicit call inspection preserves the item', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic mocked API responses.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);
  const river = page.getByRole('application', { name: 'Context River' });
  const item = river.getByRole('button', { name: 'bash: npm test', exact: true });
  await page.getByRole('button', { name: 'Pin model call 4', exact: true }).click();
  await item.click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await page.getByRole('button', { name: 'Pin model call 4', exact: true }).click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await item.press('Enter');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  const laterItem = river.getByRole('button', { name: 'retained tail', exact: true });
  await laterItem.press('Space');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await expect(laterItem).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.plot-background').evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    node.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: bounds.right - 1,
        clientY: bounds.top + 1,
      }),
    );
  });
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 4');
  await expect(laterItem).toHaveAttribute('aria-pressed', 'true');
});

test('treemap selection offers first inclusion even when the item is present at the pinned call', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic mocked analysis.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);
  await page.getByRole('button', { name: 'Pin model call 2', exact: true }).click();
  await page.getByRole('tab', { name: 'Composition' }).click();
  const tile = page.locator('.composition-treemap [data-composition-item="a"]');
  await tile.click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await page
    .locator('.item-details')
    .getByRole('button', { name: 'Inspect first included call · 1', exact: true })
    .click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(tile).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Composition' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page.locator('.item-details').getByRole('button', { name: /Inspect first included call/ }),
  ).toHaveCount(0);
});

test('Composition pins explicitly, shares selection state, and reveals from its inspector', async ({
  page,
}) => {
  test.skip(integrated, 'This Composition interaction smoke uses a deterministic mocked analysis.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);

  await page.getByRole('tab', { name: 'Composition' }).click();
  await page.getByRole('button', { name: 'At call', exact: true }).click();
  await expect(page.getByText(/Pin a call to inspect its item estimates/)).toBeVisible();
  await page.getByRole('button', { name: 'Inspect latest call' }).click();
  await expect(page.getByRole('heading', { name: 'Context composition · Call 4' })).toBeVisible();
  await page.getByRole('button', { name: 'List' }).click();
  await expect(page.locator('.composition-list [role="option"]')).toHaveCount(3);
  await page.locator('.composition-list [data-composition-item="gap"]').click();
  await expect(page.locator('.item-details h3')).toContainText('<img');

  await page.getByRole('button', { name: 'Inspect previous call', exact: true }).click();
  await expect(page.getByText(/not present at pinned call 3/)).toBeVisible();
  await page
    .getByRole('tabpanel', { name: 'Composition' })
    .getByRole('button', { name: 'Reveal in River' })
    .click();
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'River' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Pinned call 3' })).toBeVisible();
  await expect(page.locator('.ribbon-group.selected')).toHaveCount(2);
  await expect(page.locator('.ribbon-hit[aria-pressed="true"]')).toHaveCount(2);
  await expect(page.locator('.ribbon-group.related, .ribbon-group.dimmed')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Composition' }).click();
  await page.getByRole('button', { name: 'List' }).click();
  const listBounds = await page.locator('.composition-list').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(listBounds.scrollWidth).toBeLessThanOrEqual(listBounds.clientWidth + 1);
});

test('cumulative Composition, Find in lifespans, and collapsed dense browsing stay accessible', async ({
  page,
}) => {
  test.skip(integrated, 'This dense Composition regression uses generated mocked data.');
  const analysis = compositionScenario(1100);
  analysis.contextItems[10].label = 'Read · /repo/packages/alpha/src/config.ts';
  analysis.contextItems[11].label = 'Read · /repo/packages/beta/src/config.ts';
  analysis.contextItems[12].label = `Unicode · ${'界'.repeat(80)}`;
  await mockApi(page, analysis);
  await page.goto('/');
  await assertLoaded(page);

  const disclosure = page.locator('.lifespan-disclosure');
  const summary = disclosure.locator(':scope > summary');
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(0);
  const collapsedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(collapsedHeight).toBeLessThan(5000);
  await summary.click();
  // Long lists render a page of rows at a time.
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(200);
  await expect(page.locator('.more-rows')).toContainText('Showing 200 of 1,100 items');
  expect(
    await page.locator('[data-lifespan-item-id="composition-item-010"] .item-label').textContent(),
  ).toBe('Read · alpha/src/config.ts');
  await expect(page.locator('[data-lifespan-item-id="composition-item-010"]')).toHaveAttribute(
    'aria-label',
    /repo\/packages\/alpha\/src\/config\.ts/,
  );
  const expandedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(expandedHeight).toBeGreaterThan(collapsedHeight);

  await page.getByRole('button', { name: 'Show 200 more' }).click();
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(400);
  await page.getByRole('combobox', { name: 'Sort items' }).selectOption('firstAppearance');
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(200);
  await page.getByRole('combobox', { name: 'Sort items' }).selectOption('tokenTurns');

  const search = page.getByRole('searchbox', { name: 'Search items' });
  await search.fill('Composition item 1099');
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(1);
  await expect(page.locator('.result-count')).toHaveText('1 of 1,100 items');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(200);

  await page.getByRole('tab', { name: 'Composition' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cumulative context usage · Whole session' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const list = page.locator('.composition-list');
  await list.locator('[data-composition-item="composition-item-1099"]').click();
  await page.getByRole('button', { name: 'Find in lifespans' }).click();
  const selectedRow = page.locator('[data-lifespan-item-id="composition-item-1099"]');
  await expect(selectedRow).toBeFocused();
  await expect(selectedRow).toBeInViewport();

  await search.fill('no matching item');
  await expect(page.getByText(/selected item is hidden by these filters/i)).toBeVisible();
  await page.getByRole('tab', { name: 'Composition' }).click();
  await page.getByRole('button', { name: 'Find in lifespans' }).click();
  const resetAndFind = page.getByRole('button', { name: 'Reset filters and find item' });
  await expect(resetAndFind).toBeFocused();
  await resetAndFind.click();
  await expect(selectedRow).toBeFocused();
  // Finding an item extends the rendered page far enough to include it.
  expect(await page.locator('.lifespan-panel .row').count()).toBeGreaterThanOrEqual(200);

  await page.getByRole('tab', { name: 'Composition' }).click();
  await list.focus();
  const pageScrollBefore = await page.evaluate(() => window.scrollY);
  for (const key of ['Home', 'ArrowDown', 'End']) {
    await page.keyboard.press(key);
    const activeId = await list.getAttribute('aria-activedescendant');
    const activeOption = page.locator(`[id="${activeId}"]`);
    const [listBounds, optionBounds, pageScrollAfter] = await Promise.all([
      list.boundingBox(),
      activeOption.boundingBox(),
      page.evaluate(() => window.scrollY),
    ]);
    expect(listBounds).not.toBeNull();
    expect(optionBounds).not.toBeNull();
    expect(optionBounds!.y).toBeGreaterThanOrEqual(listBounds!.y);
    expect(optionBounds!.y + optionBounds!.height).toBeLessThanOrEqual(
      listBounds!.y + listBounds!.height,
    );
    expect(pageScrollAfter).toBe(pageScrollBefore);
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(summary).toBeInViewport();
  await summary.click();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(0);
});

test('touch activation in Composition List selects the same item identity', async ({ browser }) => {
  test.skip(integrated, 'This touch selection regression uses generated mocked data.');
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await mockApi(page, compositionScenario(12));
    await page.goto('/');
    await assertLoaded(page);
    await page.getByRole('button', { name: 'Pin model call 4' }).click();
    await page.getByRole('tab', { name: 'Composition' }).click();
    await page.getByRole('button', { name: 'At call' }).click();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    const option = page.locator('.composition-list [data-composition-item="composition-item-001"]');
    await option.tap();
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.item-details h3')).toHaveText('Composition item 001');
  } finally {
    await context.close();
  }
});

test('Composition group headings stay clipped inside narrow adjacent groups', async ({ page }) => {
  test.skip(integrated, 'The narrow-group regression uses generated mocked data.');
  const analysis = compositionScenario(4);
  const assistant = analysis.contextItems[0];
  assistant.kind = 'assistantMessage';
  assistant.tokenEstimates.find((estimate) => estimate.profileId === 'profile-2')!.tokens = 1_000;
  assistant.tokenTurns = 22_000;
  analysis.contextItems[1].kind = 'toolResult';
  analysis.contextItems[2].kind = 'assistantMessage';
  analysis.contextItems[3].kind = 'assistantMessage';
  await mockApi(page, analysis);
  await page.goto('/');
  await assertLoaded(page);
  await page.getByRole('button', { name: 'Pin model call 4' }).click();
  await page.getByRole('tab', { name: 'Composition' }).click();
  await page.getByRole('button', { name: 'At call' }).click();

  const assistantGroup = page.locator('g.kind-group[aria-label="Assistant messages group"]');
  await expect(assistantGroup.locator('title')).toHaveText('Assistant messages');
  const layout = await page.locator('.composition-treemap').evaluate((svg) => {
    const groups = [...svg.querySelectorAll<SVGGElement>('g.kind-group')];
    return groups.map((group) => {
      const rect = group.querySelector('rect')!.getBBox();
      const text = group.querySelector('text');
      const clipPath = text?.getAttribute('clip-path')?.match(/#([^)]*)/)?.[1];
      const clipRect = clipPath
        ? svg.querySelector(`#${CSS.escape(clipPath)} rect`)?.getBBox()
        : null;
      return {
        label: group.getAttribute('aria-label'),
        rect: { x: rect.x, y: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height },
        text: text?.textContent ?? '',
        clipped: clipRect
          ? clipRect.x >= rect.x &&
            clipRect.y >= rect.y &&
            clipRect.x + clipRect.width <= rect.x + rect.width &&
            clipRect.y + clipRect.height <= rect.y + rect.height
          : text === null,
      };
    });
  });
  expect(
    layout.find((group) => group.label === 'Assistant messages group')?.text.length,
  ).toBeLessThan('Assistant messages'.length);
  expect(layout.every((group) => group.clipped)).toBe(true);
  for (let left = 0; left < layout.length; left += 1) {
    for (let right = left + 1; right < layout.length; right += 1) {
      const a = layout[left].rect;
      const b = layout[right].rect;
      expect(
        a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1,
      ).toBe(true);
    }
  }
});

test('Copilot Responses shows read/write/fresh cache bars and qualified model-rate costs', async ({
  page,
}) => {
  test.skip(integrated, 'Uses a sanitized production Rust export.');
  const analysis = JSON.parse(
    readFileSync(resolve('../fixtures/analysis/copilot-economics.json'), 'utf8'),
  ) as WireSessionAnalysis;
  await mockApi(page, analysis);
  await page.goto('/#session=browser-smoke&pin=2');
  await assertLoaded(page);
  await expandEconomics(page);
  const fill = page.locator('#economics-call-2');
  const hit = page.locator('#economics-call-3');
  await expect(fill.locator('.cache-segment.cacheWrite')).toBeVisible();
  await expect(fill.locator('.cache-segment.fresh')).toHaveCount(1);
  await expect(hit.locator('.cache-segment.cacheRead')).toBeVisible();
  await expect(hit.locator('.cache-segment.cacheWrite')).toBeVisible();
  await page.getByText('Usage and economics', { exact: true }).click();
  const details = page.getByRole('region', { name: 'Pinned call 2' });
  await expect(details).toContainText('Fresh input');
  await expect(fill).toHaveAttribute('aria-label', /55,485/);
  await expect(fill).toHaveAttribute('aria-label', /55,482/);
  await expect(details).toContainText('55.5K');
  await expect(details).toContainText('Cache-write share');
  await expect(details).toContainText(
    'do not measure Copilot subscription charges or premium requests',
  );
  await expect(details).not.toContainText('Provider/API policy is unsupported');
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pinned call 3' })).toContainText('55.9K');
});

test('recorded Pi system and tools are visible at call 1 and survive revision and compaction navigation', async ({
  page,
}) => {
  test.skip(integrated, 'Uses a sanitized production Rust export.');
  const analysis = JSON.parse(
    readFileSync(resolve('../fixtures/analysis/system-context.json'), 'utf8'),
  ) as WireSessionAnalysis;
  const systems = analysis.contextItems.filter((item) => item.kind === 'system');
  const initial = systems.find((item) => item.firstModelCall === 1)!;
  const later = systems.find((item) => item.firstModelCall === 2)!;
  await mockApi(page, analysis);
  await page.goto('/#session=browser-smoke&view=river&display=items&pin=1&range=1:1');
  await assertLoaded(page);
  const systemRibbon = page.getByRole('button', { name: 'System prompt', exact: true }).first();
  await expect(systemRibbon).toBeVisible();
  const ribbon = systemRibbon.locator('..').locator('.ribbon');
  expect(
    await ribbon.evaluate((node) => {
      const b = (node as SVGGraphicsElement).getBBox();
      return b.height;
    }),
  ).toBeGreaterThan(10);
  await expect(page.getByRole('button', { name: /read definition/ }).first()).toBeVisible();
  expect(
    analysis.compactions.every((event) =>
      event.sourceItemIds.every(
        (id) =>
          !analysis.contextItems.some(
            (item) => item.id === id && (item.kind === 'system' || item.kind === 'toolDefinition'),
          ),
      ),
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.playwright/calm-workspace/pi-system-river-call1.png',
    fullPage: true,
  });
  await openViewOptions(page);
  await page.getByRole('button', { name: 'Item types', exact: true }).click();
  await expect(page.getByRole('button', { name: /Item type System/ }).first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'Item type legend' })).toContainText(
    'Tool Definition',
  );
  await page.getByRole('button', { name: 'Items', exact: true }).click();
  await page.getByRole('tab', { name: 'Composition' }).click();
  await page.getByRole('button', { name: 'At call', exact: true }).click();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const initialRow = page.locator(`[data-composition-item="${initial.id}"]`);
  await expect(initialRow).toBeVisible();
  await expect(page.locator('.composition-list')).toContainText('read definition');
  await expect(page.locator('.composition-list')).toContainText('bash definition');
  await initialRow.click();
  await page.screenshot({
    path: '.playwright/calm-workspace/pi-system-composition-call1.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Inspect next call', exact: true }).click();
  await expect(page.getByText(/not present at pinned call 2/)).toBeVisible();
  await expect(initialRow).toHaveCount(0);
  await expect(page.locator(`[data-composition-item="${later.id}"]`)).toBeVisible();
  await page.getByRole('button', { name: 'Inspect next call', exact: true }).click();
  await expect(page.locator(`[data-composition-item="${later.id}"]`)).toBeVisible();
  await expect(page.locator('.composition-list')).not.toContainText('bash definition');
  await page.getByRole('button', { name: 'Cumulative', exact: true }).click();
  await expect(initialRow).toBeVisible();
  await expect(page.locator(`[data-composition-item="${later.id}"]`)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.playwright/calm-workspace/pi-system-composition-narrow.png',
    fullPage: true,
  });
});

test('failed default-zero usage breaks the input reference and keeps raw zeros in details', async ({
  page,
}) => {
  test.skip(integrated, 'Uses live Rust synthetic failed-attempt export.');
  const analysis = structuredClone(failedUsageExport);
  await mockApi(page, analysis);
  await page.goto('/#session=browser-smoke&pin=2');
  await assertLoaded(page);
  const legend = page.getByRole('group', { name: 'Input reference legend' });
  await expect(legend).toContainText('Call 2');
  await expect(legend).toContainText('input comparison unavailable');
  await expect(page.locator('.reported-input-line')).toHaveCount(2);
  const inspector = page.getByRole('region', { name: 'Pinned call 2' });
  await expect(inspector.locator('.essential-metrics')).toContainText('Unavailable');
  await inspector.getByText('Usage and economics', { exact: true }).click();
  await expect(inspector.locator('[aria-label="Raw recorded placeholders"]')).toContainText(
    'Total tokens (raw placeholder)',
  );
  await expect(
    inspector.getByText('Total tokens (raw placeholder)', { exact: true }).locator('..'),
  ).toContainText('0');
  await openViewOptions(page);
  await page.getByRole('button', { name: 'Item types', exact: true }).click();
  await expect(legend).toContainText('input comparison unavailable');
  await expect(page.locator('.reported-input-line')).toHaveCount(2);
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(legend).toContainText('Call 3');
  await expect(legend).toContainText('input comparison unavailable');
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(legend).toContainText('Call 4');
  await expect(legend).not.toContainText('input comparison unavailable');
});

test('reported input extends the visible stack without becoming an item type or intercepting navigation', async ({
  page,
}) => {
  test.skip(integrated, 'Uses synthetic comparison values.');
  const analysis = structuredClone(testAnalysis());
  for (const call of analysis.modelCalls) {
    call.reportedPromptTokens = call.tokenAnalysis.calculatedVisibleTokens! + 1000;
    call.reportedUsageCompleteness = 'complete';
    call.usage = { ...call.usage, input: call.reportedPromptTokens, cacheRead: 0, cacheWrite: 0 };
  }
  await mockApi(page, analysis);
  await page.goto('/#session=browser-smoke&pin=1');
  await assertLoaded(page);
  const legend = page.getByRole('group', { name: 'Input reference legend' });
  await expect(legend).toContainText('Unreconciled input');
  await expect(legend).toContainText('Call 1');
  const geometry = await page
    .locator('.reported-input-line')
    .first()
    .evaluate((node) => {
      const point = (node as SVGPathElement).getPointAtLength(0);
      return { x: point.x, y: point.y, events: getComputedStyle(node).pointerEvents };
    });
  expect(geometry.y).toBeCloseTo(446 - (410 * 1085) / 1095, 2);
  expect(geometry.events).toBe('none');
  await expect(page.locator('.unreconciled-input').first()).toHaveAttribute('mask', /input-mask/);
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(legend).toContainText('Call 2');
  await openViewOptions(page);
  await page.getByRole('button', { name: 'Item types', exact: true }).click();
  await expect(legend).toBeVisible();
  await expect(page.getByRole('group', { name: 'Item type legend' })).not.toContainText(
    'Unreconciled input',
  );
  await expect(page.getByRole('button', { name: /Item type Unreconciled/ })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
});

test('Item types use distinct semantic colors consistently in ribbons and legend without changing individual colors', async ({
  page,
}) => {
  test.skip(integrated, 'Uses all nine synthetic categories.');
  const allKinds = compositionScenario(27, true);
  allKinds.displayWeightUnit = 'estimatedTokens';
  allKinds.tokenAnalysis.chartUnit = 'estimatedTokens';
  await mockApi(page, allKinds);
  await page.goto('/#session=browser-smoke&display=items');
  await assertLoaded(page);
  const fills = await page
    .locator('.ribbon-group .ribbon')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
  await openViewOptions(page);
  await page.getByRole('button', { name: 'Item types', exact: true }).click();
  const grouped = page.locator('.ribbon-group .ribbon');
  await expect(grouped).toHaveCount(9);
  const actual = await grouped.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('fill')),
  );
  expect(new Set(actual).size).toBe(9);
  expect([...actual].sort()).toEqual(Object.values(ITEM_TYPE_PALETTE).sort());
  const ribbonRgb = await grouped.evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).fill).sort(),
  );
  const legendRgb = await page
    .getByRole('group', { name: 'Item type legend' })
    .locator('i')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor).sort());
  expect(legendRgb).toEqual(ribbonRgb);
  expect(
    await grouped.evaluateAll((nodes) =>
      nodes.every(
        (node) =>
          node.getAttribute('stroke') === 'none' ||
          node.getAttribute('stroke') === node.getAttribute('fill'),
      ),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Items', exact: true }).click();
  expect(
    await page
      .locator('.ribbon-group .ribbon')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill'))),
  ).toEqual(fills);
  const core = testAnalysis();
  core.contextItems.find((item) => item.id === 'gap')!.kind = 'assistantMessage';
  await mockApi(page, core);
  await page.goto('/#session=browser-smoke&display=itemTypes');
  await page.reload();
  await assertLoaded(page);
  await expect(page.locator('.ribbon-group .ribbon')).toHaveCount(5);
  await page.screenshot({
    path: '.playwright/calm-workspace/item-type-colors.png',
    fullPage: true,
  });
});

test('River display grouping follows the URL, reload and Back/Forward with saved defaults', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic session IDs.');
  await mockApi(page);
  await page.goto('/#session=browser-smoke&display=itemTypes');
  await assertLoaded(page);
  await openViewOptions(page);
  await expect(page.getByRole('button', { name: 'Item types', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Items', exact: true }).click();
  await expect(page).toHaveURL(/display=items(?:&|$)/);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Item types', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Items', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await assertLoaded(page);
  await openViewOptions(page);
  await expect(page.getByRole('button', { name: 'Items', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Explicitly store Item types, then drop URL state: use the saved preference.
  await page.getByRole('button', { name: 'Item types', exact: true }).click();
  await expect(page).toHaveURL(/display=itemTypes(?:&|$)/);
  await page.goto('/#session=browser-smoke');
  await assertLoaded(page);
  await openViewOptions(page);
  await expect(page.getByRole('button', { name: 'Item types', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('view links copy, reload, and restore explicit navigation through Back and Forward', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic session IDs.');
  await mockApi(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copiedViewLink: string }).copiedViewLink = text;
        },
      },
    }),
  );
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.getByRole('button', { name: 'Copy view link', exact: true })).toBeEnabled();
  const initial = page.url();
  const length = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'bash: npm test', exact: true }).hover();
  expect(page.url()).toBe(initial);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(page).toHaveURL(/pin=1/);
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(page).toHaveURL(/pin=2/);
  const second = page.url();
  expect(await page.evaluate(() => history.length)).toBe(length + 2);
  await page.goBack();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(page).toHaveURL(/pin=1/);
  await page.goForward();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await expect(page).toHaveURL(second);
  await page.getByRole('button', { name: 'Copy view link', exact: true }).click();
  await expect(page.getByRole('status', { name: 'View link status' })).toContainText(
    'View link copied',
  );
  const copied = await page.evaluate(
    () => (window as unknown as { copiedViewLink: string }).copiedViewLink,
  );
  expect(copied).toBe(page.url());
  await page.goto(copied);
  await assertLoaded(page);
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
});

test('view links restore Composition scope and absent items, and reject stale references safely', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic session IDs.');
  await mockApi(page);
  await page.goto('/#session=browser-smoke&view=composition&scope=atCall&pin=3&item=a&range=2:4');
  await expect(page.getByRole('combobox', { name: 'Session' })).toHaveValue('browser-smoke');
  await expect(page.getByRole('tab', { name: 'Composition', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 3');
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/range=2%3A4/);
  await page.getByRole('tab', { name: 'River', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy view link', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/item=a/);
  await page.goto('/#session=browser-smoke&pin=999&item=gone&range=1:999');
  await assertLoaded(page);
  await expect(page.getByRole('status', { name: 'View link status' })).toContainText(
    'no longer available',
  );
  await expect(page.locator('#pinned-call-summary')).toHaveCount(0);
  await expect(page.getByText('Selected item', { exact: true })).toHaveCount(0);
  await page.goto('/#session=gone&pin=3&item=a');
  await assertLoaded(page);
  await expect(page.getByRole('status', { name: 'View link status' })).toContainText(
    'not available here',
  );
  await expect(page.locator('#pinned-call-summary')).toHaveCount(0);
  await expect(page.getByText('Selected item', { exact: true })).toHaveCount(0);
});

test('pan and zoom replace the view fragment without flooding browser history', async ({
  page,
}) => {
  test.skip(integrated, 'Uses a known long fixture.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.getByRole('button', { name: 'Copy view link', exact: true })).toBeEnabled();
  const initial = page.url();
  const length = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy view link', exact: true })).toBeEnabled();
  await expect(page).not.toHaveURL(initial);
  expect(await page.evaluate(() => history.length)).toBe(length);
  const zoomed = page.url();
  await page.locator('.river-scroll').evaluate((node) => {
    node.scrollLeft += 400;
  });
  await expect(page).not.toHaveURL(zoomed);
  expect(await page.evaluate(() => history.length)).toBe(length);
  const ranged = page.url();
  await page.goto(ranged);
  await assertLoaded(page);
  await expect(page.getByRole('button', { name: 'Copy view link', exact: true })).toBeEnabled();
  expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).has('range')).toBe(true);
});

test('compaction sources blend into the actual summary without interactive or retained-item merge bands', async ({
  page,
}) => {
  test.skip(integrated, 'Uses a known compaction source/retained pair.');
  await mockApi(page, testAnalysis());
  await page.goto('/');
  await assertLoaded(page);
  const merges = page.locator('.compaction-merge');
  await expect(merges).toHaveCount(1);
  await expect(merges).toHaveAttribute('aria-hidden', 'true');
  expect(await merges.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe('none');
  const gradientId = await merges.evaluate((node) => node.getAttribute('fill')!.slice(5, -1));
  const gradient = page.locator(`linearGradient[id="${gradientId}"]`);
  await expect(gradient.locator('stop')).toHaveCount(2);
  const summaryFill = await page
    .locator('.ribbon-group')
    .filter({
      has: page.getByRole('button', { name: 'Compaction summary', exact: true }),
    })
    .locator('.ribbon')
    .getAttribute('fill');
  await expect(gradient.locator('stop').last()).toHaveAttribute('stop-color', summaryFill!);
  // Emphasis is drawn over the unchanged base merge in the overlay layer.
  await expect(page.locator('.compaction-merge-emphasis')).toHaveCount(0);
  await page.getByRole('button', { name: 'bash: npm test', exact: true }).click();
  const emphasis = page.locator('.river-overlay .compaction-merge-emphasis.emphasized');
  await expect(emphasis).toHaveCount(1);
  await expect(emphasis).toHaveAttribute('fill', `url(#${gradientId})`);
  expect(Number(await emphasis.evaluate((node) => getComputedStyle(node).opacity))).toBeGreaterThan(
    0,
  );
  await expect(page.locator('.lineage-connector.visible')).toHaveCount(1);
  await page.screenshot({
    path: '.playwright/calm-workspace/compaction-merge-selected.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Close context item', exact: true }).click();
  await page.screenshot({
    path: '.playwright/calm-workspace/compaction-merge-default.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(merges).toHaveCount(1);
  expect(await merges.getAttribute('d')).not.toMatch(/NaN|Infinity/);
  await openViewOptions(page);
  await page.getByRole('button', { name: 'Item types', exact: true }).click();
  await expect(merges).toHaveCount(0);
});

test('call timing follows each pinned response with qualified rates and explicit unavailable data', async ({
  page,
}) => {
  test.skip(integrated, 'Uses controlled per-response clock pairs.');
  const analysis = testAnalysis();
  analysis.session.source = 'pi';
  const first = analysis.modelCalls[0];
  first.api = 'openai-codex-responses';
  first.timing = {
    startedAtMs: 1700000000000,
    recordedAtMs: 1700000002000,
    durationMs: 2000,
    effectiveOutputTokensPerSecond: 1,
    basis: 'pi-message-timestamps',
  };
  const second = analysis.modelCalls[1];
  second.api = 'openai-codex-responses';
  second.timing = {
    startedAtMs: 1700003600000,
    recordedAtMs: 1700003601000,
    durationMs: 1000,
    effectiveOutputTokensPerSecond: 2,
    basis: 'pi-message-timestamps',
  };
  await mockApi(page, analysis);
  await page.goto('/');
  await assertLoaded(page);
  const next = page.getByRole('button', { name: 'Next call', exact: true });
  await next.click();
  const metrics = page.locator('.call-details .essential-metrics');
  await expect(metrics.getByText('Response time (approx.)')).toBeVisible();
  await expect(metrics.getByText('2 s', { exact: true })).toBeVisible();
  await expect(metrics.getByText('1 tok/s', { exact: true })).toHaveAttribute(
    'title',
    /not generation-only speed/,
  );
  await next.click();
  await expect(metrics.getByText('1 s', { exact: true })).toBeVisible();
  await expect(metrics.getByText('2 tok/s', { exact: true })).toBeVisible();
  await next.click();
  await expect(metrics.getByText('Unavailable', { exact: true })).toHaveCount(2);
});

test('compact call buttons and arrow/vim shortcuts step safely without stealing editing or tab keys', async ({
  page,
}) => {
  test.skip(integrated, 'Uses isolated shortcut focus and four-call boundaries.');
  await mockApi(page, testAnalysis());
  await page.goto('/');
  await assertLoaded(page);
  const previous = page.getByRole('button', { name: 'Previous call', exact: true });
  const next = page.getByRole('button', { name: 'Next call', exact: true });
  await expect(previous).toHaveText('‹');
  await expect(next).toHaveText('›');
  const left = (await previous.boundingBox())!;
  const right = (await next.boundingBox())!;
  expect(left.width).toBe(right.width);
  expect(left.height).toBe(right.height);
  await page.keyboard.press('l');
  await expect(page.locator('#pinned-call-summary')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.river-scroll')).toBeFocused();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await page.keyboard.press('l');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await page.keyboard.press('h');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await page.locator('.lifespan-disclosure > summary').click();
  const search = page.getByRole('searchbox', { name: 'Search items' });
  await search.fill('');
  await search.press('h');
  await search.press('l');
  await search.press('ArrowLeft');
  await expect(search).toHaveValue('hl');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await page.getByLabel('Call number').press('ArrowRight');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await page.getByLabel('Call number').press('Escape');
  const tab = page.getByRole('tab', { name: 'River', exact: true });
  await tab.focus();
  await tab.press('h');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await tab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Composition', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.locator('.composition').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('l');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await page.getByRole('tab', { name: 'River', exact: true }).click();
  await next.click();
  await next.click();
  await expect(next).toBeDisabled();
  await page.keyboard.press('h');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 3');
});

test('Previous/Next select calls without dropping the item, changing zoom, or needless recentering', async ({
  page,
}) => {
  test.skip(integrated, 'Uses a sanitized short session and explicit call boundaries.');
  await mockApi(page, testAnalysis());
  await page.goto('/');
  await assertLoaded(page);
  const previous = page.getByRole('button', { name: 'Previous call', exact: true });
  const next = page.getByRole('button', { name: 'Next call', exact: true });
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(previous).toBeDisabled();
  await page.locator('.lifespan-disclosure > summary').click();
  await page.locator('[data-lifespan-item-id="a"] .item-label').click();
  await next.click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await next.click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 3');
  await expect(page.locator('#selected-item-summary')).toHaveText('bash: npm test');
  await expect(page.getByText(/not present at pinned call 3/)).toBeVisible();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  await next.click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 4');
  await expect(next).toBeDisabled();
  await previous.press('Enter');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 3');
  await expect(page.locator('.go-to-disclosure')).toHaveCount(0);
});

test('Go to call pins its target and preserves Fit all, zoom and independent item selection', async ({
  page,
}) => {
  test.skip(integrated, 'Uses a deterministic long session.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);
  await page.locator('.ribbon-hit').first().click();
  const selected = await page.locator('#selected-item-summary').textContent();
  const jump = async (value: string, index: number) => {
    await expect(
      page.getByRole('group', { name: 'Chart zoom and navigation' }).getByLabel('Call number'),
    ).toBeVisible();
    await expect(page.getByLabel('Range start call')).toHaveCount(0);
    await expect(page.getByText('Precise navigation', { exact: true })).toHaveCount(0);
    await page.getByLabel('Call number').fill(value);
    await page.getByLabel('Call number').press('Enter');
    await expect(page.locator('#pinned-call-summary')).toHaveText(`Pinned call ${index}`);
    await expect(page.locator('#selected-item-summary')).toHaveText(selected!);
    await expect(page.locator('.view-options')).not.toHaveAttribute('open', '');
    await expect(page.getByLabel('Call number')).toBeFocused();
  };
  await jump('80', 80);
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const zoom = await page.locator('.zoom-level').textContent();
  const width = await page.locator('.river-scroll .river-plot').getAttribute('width');
  await jump('160', 160);
  expect(await page.locator('.zoom-level').textContent()).toBe(zoom);
  expect(await page.locator('.river-scroll .river-plot').getAttribute('width')).toBe(width);
  const host = (await page.getByTestId('river-host').boundingBox())!;
  const marker = (await page
    .getByRole('button', { name: 'Pin model call 160', exact: true })
    .boundingBox())!;
  expect(marker.x + marker.width / 2).toBeGreaterThan(host.x);
  expect(marker.x + marker.width / 2).toBeLessThan(host.x + host.width);
  await jump('999', 160);
  expect(await page.locator('.zoom-level').textContent()).toBe(zoom);
  await jump('1', 1);
  expect(await page.locator('.zoom-level').textContent()).toBe(zoom);
});

test('unpinned stepping uses the measured viewport centre and nudges off-screen pins at unchanged zoom', async ({
  page,
}) => {
  test.skip(integrated, 'Uses a long session and measured plot coordinates.');
  const analysis = sessionScenario('longSession');
  await mockApi(page, analysis);
  await page.goto('/');
  await assertLoaded(page);
  const host = page.locator('.river-scroll');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await host.evaluate((node) => {
    node.scrollLeft = node.scrollWidth * 0.3;
    node.dispatchEvent(new Event('scroll'));
  });
  const centre = await host.evaluate((node) => {
    const viewport = node.getBoundingClientRect();
    const plot = node.querySelector('.plot-background')!.getBoundingClientRect();
    const x = viewport.left + node.clientLeft + node.clientWidth / 2;
    // Every call participates in the axis, including unlabeled condensed ticks.
    return 1 + Math.round(((x - plot.left) / plot.width) * 159);
  });
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(page.locator('#pinned-call-summary')).toHaveText(`Pinned call ${centre + 1}`);
  const scroll = await host.evaluate((node) => node.scrollLeft);
  const zoom = await page.locator('.zoom-level').textContent();
  await page.getByRole('button', { name: 'Previous call', exact: true }).click();
  await expect(page.locator('#pinned-call-summary')).toHaveText(`Pinned call ${centre}`);
  expect(await host.evaluate((node) => node.scrollLeft)).toBeCloseTo(scroll, 0);
  await expect(page.locator('.zoom-level')).toHaveText(zoom!);
  // Make the pinned call off-screen without changing it, then step from the pin.
  await host.evaluate((node) => {
    node.scrollLeft = 0;
    node.dispatchEvent(new Event('scroll'));
  });
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  expect(await host.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator('.zoom-level')).toHaveText(zoom!);
  await page.getByRole('button', { name: 'Close pinned call', exact: true }).click();
  await page.getByRole('button', { name: 'Fit all calls', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Previous call', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Next call', exact: true }).click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
});

test('lifespan pointer positions pin calls while labels and keyboard preserve the pin and River viewport', async ({
  page,
}) => {
  test.skip(integrated, 'Uses isolated disjoint presence and explicit navigation.');
  await mockApi(page, sessionScenario('terminalCompaction'));
  await page.goto('/');
  await assertLoaded(page);
  await page.getByRole('button', { name: 'Pin model call 4', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const before = await page.locator('.river-scroll').evaluate((node) => node.scrollLeft);
  const range = await page.getByTestId('visible-call-range').textContent();
  await page.locator('.lifespan-disclosure > summary').click();
  const row = page.locator('[data-lifespan-item-id="a"]');
  await row.locator('.track').scrollIntoViewIfNeeded();
  const track = (await row.locator('.track').boundingBox())!;
  // Call 2 lies one third of the way along the four-call axis.
  await page.mouse.click(track.x + track.width / 3, track.y + track.height / 2);
  await expect(page.locator('#selected-item-summary')).toHaveText('bash: npm test');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await expect(row.locator('.pin-marker')).toHaveAttribute('style', /33/);
  const retained = page.locator('[data-lifespan-item-id="retained"]');
  await retained.getByRole('button', { name: 'Select retained tail', exact: true }).click();
  await expect(page.locator('#selected-item-summary')).toHaveText('retained tail');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  const gap = page.locator('[data-lifespan-item-id="gap"]');
  await gap.locator('.segment').last().press('Enter');
  await expect(page.locator('#selected-item-summary')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await gap.locator('.segment').last().press('Space');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 2');
  await gap.locator('.segment').last().click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 4');
  await row.locator('.segment').hover();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 4');
  await page.locator('[data-lifespan-item-id="terminal-summary"] .terminal-item').click();
  await expect(page.locator('#selected-item-summary')).toHaveText('Terminal compaction summary');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 4');
  expect(await page.locator('.river-scroll').evaluate((node) => node.scrollLeft)).toBeCloseTo(
    before,
    1,
  );
  await expect(page.getByTestId('visible-call-range')).toHaveText(range!);
  await expect(page.getByRole('tab', { name: 'River', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('lifespan touch activation pins its call without switching Composition', async ({
  browser,
}) => {
  test.skip(integrated, 'Uses a sanitized touch browsing context.');
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await mockApi(page, testAnalysis());
    await page.goto('/');
    await assertLoaded(page);
    await page.getByRole('button', { name: 'Pin model call 2', exact: true }).press('Enter');
    await page.getByRole('tab', { name: 'Composition', exact: true }).click();
    await page.locator('.lifespan-disclosure > summary').click();
    await page.locator('[data-lifespan-item-id="gap"] .segment').last().tap();
    await expect(page.locator('#selected-item-summary')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 4');
    await expect(page.getByRole('tab', { name: 'Composition', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  } finally {
    await context.close();
  }
});

test('Session details trigger stays stationary when opening and closing at desktop and narrow widths', async ({
  page,
}) => {
  test.skip(integrated, 'Uses isolated summary data and viewport sizes.');
  await mockApi(page, testAnalysis());
  for (const width of [1440, 800, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await assertLoaded(page);
    const details = page.locator('#session-details');
    const trigger = page.locator('#session-details-summary');
    const before = (await trigger.boundingBox())!;
    const point = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await page.mouse.click(point.x, point.y);
    await expect(details).toHaveAttribute('open', '');
    const after = (await trigger.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    await expect(details.locator('.detail-columns')).toBeVisible();
    const widths = await page.locator('.session-status').evaluate((node) => ({
      status: node.getBoundingClientRect().width,
      panel: node.querySelector('.detail-columns')!.getBoundingClientRect().width,
    }));
    expect(Math.abs(widths.status - widths.panel)).toBeLessThanOrEqual(1);
    await page.mouse.click(point.x, point.y);
    await expect(details).not.toHaveAttribute('open', '');
    const closed = (await trigger.boundingBox())!;
    expect(Math.abs(closed.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(closed.y - before.y)).toBeLessThanOrEqual(1);
    await trigger.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await trigger.press('Escape');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(trigger).toBeFocused();
  }
});

test('call changes use plain headings and left-aligned bordered lists without nested disclosures', async ({
  page,
}) => {
  test.skip(integrated, 'Uses isolated mocked call changes.');
  const analysis = testAnalysis();
  await mockApi(page, analysis);
  await page.goto('/');
  await assertLoaded(page);
  await page.getByRole('button', { name: 'Pin model call 3', exact: true }).press('Enter');
  await page
    .locator('.call-details summary')
    .filter({ hasText: /^Context changes/ })
    .click();
  await expect(page.locator('.call-details .change-lists details')).toHaveCount(0);
  const groups = page.locator('.call-details .change-list');
  await expect(groups).toHaveCount(2);
  const baselines = [analysis.modelCalls[2], analysis.modelCalls[1]];
  const ids = [analysis.modelCalls[2].addedItemIds, analysis.modelCalls[2].droppedItemIds];
  let groupIndex = 0;
  for (const group of await groups.all()) {
    const baseline = baselines[groupIndex];
    const estimate = analysis.contextItems
      .find((item) => item.id === ids[groupIndex][0])!
      .tokenEstimates.find((value) => value.profileId === baseline.tokenizationProfileId)!;
    await expect(group.getByRole('heading', { level: 4 })).toBeVisible();
    const list = group.getByRole('list');
    await expect(list).toHaveCSS('list-style-type', 'none');
    await expect(list).toHaveCSS('padding-left', '0px');
    const button = list.getByRole('listitem').first().getByRole('button');
    await expect(button).toHaveCSS('border-width', '1px');
    await expect(button).toHaveCSS('text-align', 'left');
    await expect(button).toBeVisible();
    const total = ids[groupIndex].reduce(
      (sum, id) =>
        sum +
        analysis.contextItems
          .find((item) => item.id === id)!
          .tokenEstimates.find((value) => value.profileId === baseline.tokenizationProfileId)!
          .tokens!,
      0,
    );
    const expected = estimate.tokens! / total;
    expect(
      parseFloat(
        await button.locator('.fill').evaluate((node) => (node as HTMLElement).style.width),
      ),
    ).toBeCloseTo(expected * 100, 3);
    await expect(button).toHaveAccessibleDescription(
      new RegExp(
        `of estimated ${groupIndex === 0 ? 'added' : 'dropped'} tokens \\(call ${baseline.index}\\)`,
      ),
    );
    await button.focus();
    await expect(button.locator('.detail')).toBeVisible();
    await expect(group.locator('.change-baseline')).toContainText(
      `Share of estimated ${groupIndex === 0 ? 'added' : 'dropped'} tokens`,
    );
    if (groupIndex === 1)
      await expect(group.locator('.change-baseline')).toContainText(
        `previous call ${baseline.index}`,
      );
    groupIndex++;
  }
  const addedId = analysis.modelCalls[2].addedItemIds[0];
  const label = analysis.contextItems.find((item) => item.id === addedId)!.label;
  await page
    .getByRole('button', { name: `Select added item ${label}`, exact: true })
    .press('Enter');
  await expect(page.locator('#selected-item-summary')).toHaveText(label);
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 3');
});

test('unavailable context estimates show unknown contribution rather than empty bars', async ({
  page,
}) => {
  test.skip(integrated, 'Uses sanitized unavailable token estimates.');
  await mockApi(page, sessionScenario('unavailableGeometry'));
  await page.goto('/');
  await assertLoaded(page);
  await page.getByRole('button', { name: 'Pin model call 1', exact: true }).press('Enter');
  await page
    .locator('.call-details summary')
    .filter({ hasText: /^Context changes/ })
    .click();
  const rows = page.locator('.call-details .change-lists button');
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all()) {
    await expect(row.locator('.track')).toHaveCount(0);
    await expect(row.locator('.unknown')).toHaveText('Share unavailable');
    await expect(row).toHaveAccessibleDescription(/Token estimate unknown/);
  }
});

test('inspector diagnostics retain identity and manual section choices without a bulk-collapse button', async ({
  page,
}) => {
  test.skip(integrated, 'This inspector containment regression uses generated mocked data.');
  await mockApi(page, testAnalysis());
  await page.goto('/');
  await assertLoaded(page);
  await page.getByRole('button', { name: 'Pin model call 4' }).click();
  const lifespans = page.locator('.lifespan-disclosure');
  await lifespans.locator(':scope > summary').click();
  await page.locator('[data-lifespan-item-id="a"] .segment').first().click();

  const inspector = page.locator('#inspector');
  const diagnostics = page.locator('.item-diagnostics');
  const collapse = page.getByRole('button', { name: 'Collapse details', exact: true });
  await expect(collapse).toHaveCount(0);
  const callUsage = page.locator('.call-details .usage-breakdown');
  await callUsage.locator('summary').click();
  await diagnostics.locator('summary').click();
  expect(await inspector.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await inspector.evaluate((element) => (element.scrollTop = element.scrollHeight));
  await expect(page.getByRole('heading', { name: 'bash: npm test' })).toBeVisible();
  await expect(collapse).toHaveCount(0);
  await diagnostics.locator('summary').click();
  await expect(diagnostics).not.toHaveAttribute('open', '');
  await expect(callUsage).toHaveAttribute('open', '');

  await inspector.evaluate((element) => (element.scrollTop = element.scrollHeight));
  await page.locator('[data-lifespan-item-id="retained"] .segment').first().click();
  await expect(page.getByRole('heading', { name: 'retained tail' })).toBeVisible();
  await expect(collapse).toHaveCount(0);
  await diagnostics.locator('summary').click();
  await expect(collapse).toHaveCount(0);
  await page.locator('[data-lifespan-item-id="a"] .segment').first().click();
  await expect(diagnostics).toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: 'bash: npm test' })).toBeVisible();
  await diagnostics.locator('summary').click();
  await expect(diagnostics).not.toHaveAttribute('open', '');

  await inspector.evaluate((element) => (element.scrollTop = 0));
  await expect(page.getByRole('heading', { name: 'Model call' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pinned call' })).toBeVisible();
});

test('cache and cost tracks share the river axis and expose a ratio change', async ({ page }) => {
  test.skip(integrated, 'This track regression uses deterministic mocked economics data.');
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  await expandEconomics(page);

  const river = page.getByRole('application', { name: 'Context River' });
  const selectedItem = river.getByRole('button', { name: 'bash: npm test' });
  await selectedItem.click();
  await expect(selectedItem).toHaveAttribute('aria-pressed', 'true');

  const track = page.locator('.economics-track-svg');
  await expect(track).toBeVisible();
  await expect(page.locator('.plot-background')).toHaveAttribute('height', '410');
  await page.getByText('Legend and data quality', { exact: true }).click();
  await expect(page.getByText('Fresh / uncached input')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cache', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const riverWidth = await river.locator('svg').first().getAttribute('width');
  expect(await track.getAttribute('width')).toBe(riverWidth);
  const eventTriggers = page.locator('.track-event-trigger');
  await expect(eventTriggers).toHaveCount(3);
  await expect(eventTriggers.nth(0).locator('title')).toContainText('Cache-read share');
  await expect(eventTriggers.nth(1).locator('title')).toContainText('Compaction before call 3');
  await expect(eventTriggers.nth(2).locator('title')).toContainText(
    'Target changes from anthropic / m',
  );

  const firstMark = page.locator('#economics-call-1');
  await firstMark.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#economics-call-2')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Pinned call 2')).toBeVisible();
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();

  await page.getByText('Usage and economics', { exact: true }).click();
  const ratioNote = page.locator('.ratio-discontinuity');
  await expect(ratioNote).toContainText(
    'Cache-read share dropped from 25.0% on call 1 to 0.0% on call 2',
  );
  await page.getByRole('button', { name: 'Inspect previous call 1' }).click();
  await expect(page.getByText('Pinned call 1')).toBeVisible();
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();

  const host = page.getByTestId('river-host');
  const fitWidth = await river.locator('svg').first().getAttribute('width');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => river.locator('svg').first().getAttribute('width')).not.toBe(fitWidth);
  await expect
    .poll(() => track.getAttribute('width'))
    .toBe(await river.locator('svg').first().getAttribute('width'));
  const scrollLeft = await host.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Cost', exact: true }).click();
  await expect(page.getByText(/Cost per call · USD/)).toBeVisible();
  expect(await host.evaluate((element) => element.scrollLeft)).toBe(scrollLeft);
  expect(await track.getAttribute('width')).toBe(
    await river.locator('svg').first().getAttribute('width'),
  );
  await expect(page.locator('#economics-call-1')).toHaveAttribute('aria-label', /0\.0000000123/);
  await page.getByRole('button', { name: 'Off', exact: true }).click();
  await expect(track).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`Item type breakdown stays near the River without page or chart jumps at ${width}px`, async ({
    page,
  }) => {
    test.skip(integrated, 'Uses deterministic mocked economics data.');
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page, economicsScenario());
    await page.goto('/#session=browser-smoke&display=itemTypes');
    await assertLoaded(page);
    await expandEconomics(page);
    const group = page.locator('.group-ribbon .ribbon-hit').first();
    await group.scrollIntoViewIfNeeded();
    const snapshot = () =>
      page.evaluate(() => ({
        y: window.scrollY,
        left: document.querySelector('[data-testid="river-host"]')!.scrollLeft,
      }));
    const before = await snapshot();
    await page.evaluate(() => {
      document.body.dataset.groupActivationFocus = '';
      document.addEventListener(
        'focusin',
        (event) => {
          document.body.dataset.groupActivationFocus = (event.target as Element).id || 'chart';
        },
        { once: true },
      );
    });
    await group.click();
    const dialog = page.getByRole('dialog', { name: /Item type .* breakdown/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close item type breakdown' })).toBeFocused();
    await expect(page.locator('body')).toHaveAttribute(
      'data-group-activation-focus',
      'group-breakdown-close',
    );
    await expect(dialog).not.toContainText('Grouped geometry is presentation-only');
    expect(await snapshot()).toEqual(before);
    expect(await dialog.evaluate((node) => getComputedStyle(node).position)).toBe('fixed');
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(7);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 7);
    expect(bounds.y).toBeGreaterThanOrEqual(7);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(893);
    await page.screenshot({ path: `.playwright/calm-workspace/item-type-breakdown-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(group).toBeFocused();
    expect(await snapshot()).toEqual(before);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    expect(await snapshot()).toEqual(before);
    await dialog.getByRole('button', { name: 'Close item type breakdown' }).click();
    await expect(group).toBeFocused();
    expect(await snapshot()).toEqual(before);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.evaluate(() => window.scrollBy(0, 20));
    await expect(dialog).toHaveCount(0);
  });
}

test('scrolling a long item type member list does not dismiss its breakdown', async ({ page }) => {
  test.skip(integrated, 'Uses a synthetic many-member group.');
  await mockApi(page, compositionScenario(220));
  await page.goto('/#session=browser-smoke&display=itemTypes');
  await assertLoaded(page);
  await page.locator('.group-ribbon .ribbon-hit').first().click();
  const dialog = page.getByRole('dialog', { name: /Item type .* breakdown/ });
  await expect(dialog).toBeVisible();
  const y = await page.evaluate(() => window.scrollY);
  const list = dialog.locator('ul');
  expect(await list.evaluate((node) => node.scrollHeight)).toBeGreaterThan(
    await list.evaluate((node) => node.clientHeight),
  );
  await list.evaluate((node) => (node.scrollTop = 40));
  await expect(list).toHaveJSProperty('scrollTop', 40);
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
});

test('cache share and grouped River views preserve exact identities', async ({ page }) => {
  test.skip(
    integrated,
    'This cache presentation regression uses deterministic mocked economics data.',
  );
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  await expandEconomics(page);
  await openViewOptions(page);

  const cacheView = page.getByRole('group', { name: 'Cache view' });
  await cacheView.getByRole('button', { name: 'Tokens' }).click();
  const pinnedCacheMark = page.locator('#economics-call-1');
  await pinnedCacheMark.click();
  await expect(pinnedCacheMark).toHaveAttribute('aria-current', 'true');
  await cacheView.getByRole('button', { name: 'Share (%)' }).click();
  await expect(page.locator('.economics-readout')).toContainText(
    'Source-normalized denominator of 1,000 prompt tokens',
  );
  await expect(cacheView.getByRole('button', { name: 'Share (%)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#economics-call-1')).toHaveAttribute(
    'aria-label',
    /Source-normalized denominator of 1,000 prompt tokens/,
  );
  await expect(page.getByText(/fixed 0–100% axis/)).toBeVisible();

  await page
    .getByRole('group', { name: 'River display' })
    .getByRole('button', { name: 'Item types' })
    .click();
  await expect(page.locator('.group-type-legend')).toBeVisible();
  const group = page.locator('.group-ribbon .ribbon-hit').first();
  await group.click();
  const groupDialog = page.getByRole('dialog', { name: /Item type .* breakdown/ });
  await expect(groupDialog).toBeVisible();
  await expect(
    groupDialog.getByRole('button', { name: 'Close item type breakdown' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(groupDialog).toHaveCount(0);
  await expect(group).toBeFocused();
  await group.click();
  await expect(groupDialog).toBeVisible();
  await page.getByRole('button', { name: 'Show items here' }).click();
  await expect(
    page.getByRole('group', { name: 'River display' }).getByRole('button', { name: 'Items' }),
  ).toHaveAttribute('aria-pressed', 'true');
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

test('wheel, injected pinch and lost capture preserve item selection and the pin', async ({
  page,
}) => {
  test.skip(
    integrated,
    'Gesture transitions use deterministic mocked data and injected pointer events.',
  );
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);
  const host = page.getByTestId('river-host');
  const item = host.getByRole('button', { name: 'bash: npm test' });
  await item.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Pin model call 2' }).click();
  const bounds = (await host.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 90);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -160);
  await page.keyboard.up('Control');
  await expect(page.locator('.zoom-level')).not.toHaveText('Zoom 1.0×');
  await page.getByRole('button', { name: 'Fit all calls' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  await host.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const options = {
      bubbles: true,
      pointerId: 91,
      pointerType: 'mouse',
      clientX: x - 30,
      clientY: bounds.top + 90,
      button: 0,
    };
    element.dispatchEvent(new PointerEvent('pointerdown', options));
    window.dispatchEvent(new PointerEvent('pointermove', { ...options, clientX: x + 30 }));
  });
  await expect(page.locator('.zoom-selection')).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('lostpointercapture', { pointerId: 91, pointerType: 'mouse' }),
    ),
  );
  await expect(page.locator('.zoom-selection')).toHaveCount(0);
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  await host.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const options = { bubbles: true, pointerType: 'touch', clientY: bounds.top + 90, button: 0 };
    element.dispatchEvent(
      new PointerEvent('pointerdown', { ...options, pointerId: 91, clientX: x - 30 }),
    );
    element.dispatchEvent(
      new PointerEvent('pointerdown', { ...options, pointerId: 92, clientX: x + 30 }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', { ...options, pointerId: 92, clientX: x + 70 }),
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', { ...options, pointerId: 92, clientX: x + 70 }),
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', { ...options, pointerId: 91, clientX: x - 30 }),
    );
  });
  await expect(page.locator('.zoom-level')).not.toHaveText('Zoom 1.0×');
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Pinned call 2' })).toBeVisible();
});

test('vertical scale controls explain local ribbon heights and keep the axis anchored while panning', async ({
  page,
}) => {
  test.skip(integrated, 'This scale regression uses deterministic long-session data.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);
  await openViewOptions(page);

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
  const chartHelp = page.getByRole('button', { name: 'Chart help' });
  await chartHelp.click();
  await expect(page.locator('.help-popover')).toContainText(
    /heights can change while panning or\s+zooming/i,
  );
  await expect(page.locator('.help-popover')).toContainText(
    /Cached tokens still occupy context capacity/i,
  );
  await chartHelp.click();
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
    await captureBaselineState(page, scaleScreenshotDirectory, 'visible-scale-long-session');
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

test('Go to call remains with the zoom controls without overflow across toolbar sizes', async ({
  page,
}) => {
  test.skip(integrated, 'Uses sanitized API responses.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);
  for (const width of [1440, 800, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = page.getByRole('group', { name: 'Chart zoom and navigation' });
    const input = controls.getByLabel('Call number');
    await expect(input).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Go', exact: true })).toBeEnabled();
    const box = (await controls.boundingBox())!;
    const field = (await input.boundingBox())!;
    expect(field.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(field.x + field.width).toBeLessThanOrEqual(box.x + box.width + 1);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await openViewOptions(page);
    await expect(page.locator('.view-options').getByLabel('Call number')).toHaveCount(0);
    await page.locator('.view-options summary').press('Escape');
    await page.screenshot({ path: `.playwright/calm-workspace/go-to-toolbar-${width}.png` });
  }
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
  const controlsBeforeHelp = await controls.boundingBox();
  expect(controlsBeforeHelp).not.toBeNull();
  const helpTrigger = page.getByRole('button', { name: 'Chart help' });
  await helpTrigger.click();
  const helpBounds = await page.locator('.help-popover').boundingBox();
  expect(helpBounds).not.toBeNull();
  expect(helpBounds!.x).toBeGreaterThanOrEqual(12);
  expect(helpBounds!.y).toBeGreaterThanOrEqual(12);
  expect(helpBounds!.x + helpBounds!.width).toBeLessThanOrEqual(1268);
  expect(helpBounds!.y + helpBounds!.height).toBeLessThanOrEqual(888);
  const controlsAfterHelp = await controls.boundingBox();
  expect(controlsAfterHelp).not.toBeNull();
  expect(Math.abs(controlsAfterHelp!.x - controlsBeforeHelp!.x)).toBeLessThan(1);
  expect(Math.abs(controlsAfterHelp!.y - controlsBeforeHelp!.y)).toBeLessThan(1);
  await helpTrigger.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fit all calls' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  await zoomAndCheckStablePosition();
});

test('chart help opens within a narrow touch viewport without moving navigation', async ({
  browser,
}) => {
  test.skip(integrated, 'This touch-layout regression uses deterministic mocked API data.');
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await context.newPage();
  try {
    await mockApi(touchPage, sessionScenario());
    await touchPage.goto('/');
    await assertLoaded(touchPage);

    const controls = touchPage.locator('.viewport-navigation .controls');
    const before = await controls.boundingBox();
    const trigger = touchPage.getByRole('button', { name: 'Chart help' });
    await trigger.tap();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(touchPage.getByRole('group', { name: 'Chart help' })).toBeVisible();
    const popover = await touchPage.locator('.help-popover').boundingBox();
    const after = await controls.boundingBox();
    expect(before).not.toBeNull();
    expect(popover).not.toBeNull();
    expect(after).not.toBeNull();
    expect(popover!.x).toBeGreaterThanOrEqual(12);
    expect(popover!.y).toBeGreaterThanOrEqual(12);
    expect(popover!.x + popover!.width).toBeLessThanOrEqual(378);
    expect(popover!.y + popover!.height).toBeLessThanOrEqual(832);
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    await trigger.tap();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  } finally {
    await context.close();
  }
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
  await page.locator('.item-details').getByText('Content preview', { exact: true }).first().click();
  await expect(page.locator('.item-details .content-preview')).toBeVisible();
  await expect(page.locator('.item-details .content-preview')).toContainText(previewText);
  const previewDetails = page.locator('.preview-details');
  await expect(previewDetails.locator('details, summary')).toHaveCount(0);
  await expect(previewDetails.locator('pre')).toHaveCount(0);
  const more = previewDetails.getByRole('button', { name: 'Show more', exact: true });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toHaveCSS('font-size', '11px');
  await expect(more).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const placement = await previewDetails.evaluate((node) => {
    const container = node.getBoundingClientRect();
    const button = node.querySelector('button')!.getBoundingClientRect();
    return {
      rightGap: container.right - button.right,
      height: button.height,
      width: button.width,
      containerWidth: container.width,
    };
  });
  expect(Math.abs(placement.rightGap)).toBeLessThanOrEqual(1);
  expect(placement.height).toBeGreaterThanOrEqual(28);
  expect(placement.width).toBeLessThan(placement.containerWidth);
  await more.press('Enter');
  const less = previewDetails.getByRole('button', { name: 'Show less', exact: true });
  await expect(less).toBeFocused();
  await expect(less).toHaveAttribute('aria-expanded', 'true');
  await expect(previewDetails.locator('pre')).toContainText(`${previewText} expanded`);
  await expect(previewDetails.locator('.content-preview')).toHaveCount(0);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await less.press('Space');
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(previewDetails.locator('pre')).toHaveCount(0);
  await expect(previewDetails.locator('.content-preview')).toContainText(previewText);
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
    await restoreRiverRange(page, start, end);
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
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Context lifespans · 4 items' })).toBeVisible();
  await expect(page.locator('.ribbon-group.selected')).toHaveCount(1);
  await expect(page.locator('.ribbon-group.related, .ribbon-group.dimmed')).toHaveCount(0);
  await expect(page.locator('.lineage-connector.visible')).toHaveCount(1);

  const goTo = page.locator('.view-options');
  const goToSummary = goTo.locator('summary');
  await goToSummary.press('Enter');
  await expect(goTo).toHaveAttribute('open', '');
  const callInput = page.getByLabel('Call number');
  await expect(callInput).toBeVisible();
  await callInput.fill('3');
  await callInput.press('Escape');
  await expect(callInput).toHaveValue('');
  await expect(goTo).toHaveAttribute('open', '');
  await goToSummary.press('Escape');
  await expect(goTo).not.toHaveAttribute('open', '');
  await expect(goToSummary).toBeFocused();
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Pin model call 1' }).click();
  const callDetails = page.locator('.call-details');
  const usage = callDetails.locator('.usage-breakdown');
  await expect(usage).not.toHaveAttribute('open', '');
  await expect(usage.getByText('Input (raw normalized bucket)')).not.toBeVisible();
  await usage.locator('summary').press('Enter');
  await expect(usage).toHaveAttribute('open', '');
  await expect(usage.getByText('Input (raw normalized bucket)')).toBeVisible();
});

test('wide exploration keeps a bounded sticky inspector beside the chart', async ({ page }) => {
  test.skip(integrated, 'This workspace layout regression uses deterministic mocked API data.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);

  await page.getByRole('button', { name: 'Pin model call 1', exact: true }).press('Enter');
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
  expect(stickyTop).toBeLessThanOrEqual(32);
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

test('Composition View details reveals the selected item summary', async ({ page }) => {
  test.skip(integrated, 'This inspector-navigation regression uses deterministic mocked API data.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);

  await page.getByRole('button', { name: 'bash: npm test' }).click();
  const diagnostics = page.locator('.item-diagnostics');
  await diagnostics.locator('summary').click();
  const inspector = page.locator('#inspector');
  await inspector.evaluate((element) => (element.scrollTop = element.scrollHeight));

  await page.getByRole('tab', { name: 'Composition' }).click();
  await page.getByRole('button', { name: 'View details' }).click();
  const summary = page.locator('#selected-item-summary');
  await expect(summary).toBeFocused();
  await expect(summary).toBeInViewport();
  await expect(inspector).toContainText('Whole-session exposure · estimated token-turns');
});

test('economics overlays stay contained while the River pans and zooms', async ({ page }) => {
  test.skip(integrated, 'This economics overlay regression uses a deterministic mocked analysis.');
  await mockApi(page, clusteredEconomicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  await expandEconomics(page);

  const host = page.getByTestId('river-host');
  const cluster = page.locator('.track-event-cluster').first();
  await expect(cluster).toBeVisible();
  await cluster.locator('.event-hit').click();
  const dialog = page.getByRole('dialog', { name: 'Economics event breakdown' });
  await expect(dialog).toBeVisible();
  const [dialogBounds, hostBounds] = await Promise.all([dialog.boundingBox(), host.boundingBox()]);
  expect(dialogBounds).not.toBeNull();
  expect(hostBounds).not.toBeNull();
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(hostBounds!.x - 1);
  expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(
    hostBounds!.x + hostBounds!.width + 1,
  );
  expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(
    (page.viewportSize()?.height ?? 844) + 1,
  );
  await page.keyboard.press('Escape');
  await expect(cluster).toBeFocused();

  for (let count = 0; count < 3; count += 1)
    await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Latest' }).click();
  await expect(cluster).toBeVisible();
  await cluster.locator('.event-hit').click();
  await expect(dialog).toBeVisible();
  await host.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Latest' }).click();
  const call = page.locator('#economics-call-160');
  await call.focus();
  await expect(page.locator('.economics-readout')).toContainText('Call 160');
  const [readoutBounds, latestHostBounds] = await Promise.all([
    page.locator('.economics-readout').boundingBox(),
    host.boundingBox(),
  ]);
  expect(readoutBounds).not.toBeNull();
  expect(latestHostBounds).not.toBeNull();
  expect(readoutBounds!.x).toBeGreaterThanOrEqual(latestHostBounds!.x - 1);
  expect(readoutBounds!.x).toBeLessThan(latestHostBounds!.x + latestHostBounds!.width);

  await page.locator('#economics-call-170').focus();
  await expect(page.locator('.economics-readout')).toContainText(
    'cache-read share unavailable; prompt-token denominator is zero or unavailable',
  );
  await expect(page.locator('.economics-readout')).not.toContainText('0.0% of 0 prompt tokens');
});

test('isolated economics events support touch, keyboard, and Escape focus return', async ({
  browser,
}) => {
  test.skip(
    integrated,
    'This isolated economics interaction uses a deterministic mocked analysis.',
  );
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await mockApi(page, economicsScenario());
    await page.goto('/');
    await assertLoaded(page);
    await expandEconomics(page);

    const singleton = page.locator('.track-event-singleton').first();
    await expect(singleton).toBeVisible();
    await singleton.locator('.event-hit').tap();
    const dialog = page.getByRole('dialog', { name: 'Economics event breakdown' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('1 event');
    await page.keyboard.press('Escape');
    await expect(singleton).toBeFocused();

    await singleton.press('Enter');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(singleton).toBeFocused();
  } finally {
    await context.close();
  }
});

test('dense economics annotations fit their lane and keep the readout in flow', async ({
  page,
}) => {
  // Keep the complete dense fixture; width-only reflow must retain canonical paths.
  test.setTimeout(60_000);
  test.skip(integrated, 'This dense layout regression uses a deterministic sanitized analysis.');
  const started = Date.now();
  const timings: Record<string, number> = {};
  const record = (stage: string) => {
    timings[stage] = Date.now() - started;
    if (process.env.TOKENPLUME_PROFILE_BROWSER) console.log(stage, timings[stage]);
  };
  await mockApi(page, denseEconomicsScenario());
  record('fixture prepared');
  await page.goto('/');
  await assertLoaded(page);
  record('initial River ready');
  await expandEconomics(page);
  record('economics expanded');
  const layoutCount = await page.evaluate(
    () => performance.getEntriesByName('tokenplume-layout-river').length,
  );
  const canonicalPath = await page.locator('.ribbon-hit').first().getAttribute('d');
  await page.locator('.ribbon-hit').first().click();
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.getByTestId('river-host').evaluate((node) => node.clientWidth))
    .toBeLessThan(1100);
  expect(
    await page.evaluate(() => performance.getEntriesByName('tokenplume-layout-river').length),
  ).toBe(layoutCount);
  expect(await page.locator('.ribbon-hit').first().getAttribute('d')).toBe(canonicalPath);
  record('inspector occupied');

  const host = page.getByTestId('river-host');
  const track = page.locator('.economics-track-svg');
  await expect(track).toBeVisible();
  const geometry = await page.locator('.track-event-trigger .event-hit').evaluateAll((elements) => {
    const svg = elements[0]?.closest('svg');
    const svgBounds = svg?.getBoundingClientRect();
    const boxes = elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    });
    let overlaps = 0;
    for (let index = 1; index < boxes.length; index += 1) {
      const previous = boxes[index - 1]!;
      const current = boxes[index]!;
      if (current.left < previous.right - 0.5) overlaps += 1;
    }
    return {
      count: boxes.length,
      overlaps,
      withinSvg: boxes.every(
        (box) =>
          svgBounds &&
          box.left >= svgBounds.left - 1 &&
          box.right <= svgBounds.right + 1 &&
          box.top >= svgBounds.top - 1 &&
          box.bottom <= svgBounds.bottom + 1,
      ),
    };
  });
  expect(geometry.count).toBeGreaterThan(0);
  expect(geometry.overlaps).toBe(0);
  expect(geometry.withinSvg).toBe(true);
  expect(await page.locator('.event-count').allTextContents()).toEqual(
    expect.arrayContaining([expect.stringMatching(/^\d{3} · /)]),
  );

  const flowGeometry = await page.evaluate(() => {
    const river = document.querySelector('[data-testid="river-host"]')?.getBoundingClientRect();
    const readout = document.querySelector('.economics-readout')?.getBoundingClientRect();
    const chartPlot = document.querySelector('.chart-plot')?.getBoundingClientRect();
    return {
      riverBottom: river?.bottom ?? null,
      readoutTop: readout?.top ?? null,
      plotBottom: chartPlot?.bottom ?? null,
    };
  });
  expect(flowGeometry.readoutTop).not.toBeNull();
  expect(flowGeometry.riverBottom).not.toBeNull();
  expect(flowGeometry.plotBottom).not.toBeNull();
  expect(flowGeometry.readoutTop!).toBeGreaterThanOrEqual(flowGeometry.riverBottom! - 1);
  expect(flowGeometry.readoutTop!).toBeGreaterThanOrEqual(flowGeometry.plotBottom! - 1);
  expect(await host.evaluate((element) => element.scrollHeight)).toBe(
    await host.evaluate((element) => element.clientHeight),
  );

  for (const scrollY of [
    0,
    300,
    await page.evaluate(() => document.documentElement.scrollHeight),
  ]) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    const overlap = await page.evaluate(() => {
      const plot = document.querySelector('.chart-plot')?.getBoundingClientRect();
      const readout = document.querySelector('.economics-readout')?.getBoundingClientRect();
      return plot && readout ? readout.top < plot.bottom && readout.bottom > plot.top : false;
    });
    expect(overlap).toBe(false);
  }
  for (let count = 0; count < 3; count += 1)
    await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Latest' }).click();
  await page.locator('#economics-call-1000').focus();
  await expect(page.locator('.economics-readout')).toContainText('Call 1000');
  record('zoomed and panned');

  await page.setViewportSize({ width: 390, height: 844 });
  record('narrow reflow');
  const endpointTrigger = page.locator('.track-event-trigger').last();
  await endpointTrigger.locator('.event-hit').click();
  const dialog = page.getByRole('dialog', { name: 'Economics event breakdown' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('position', 'static');
  const [dialogBounds, plotBounds] = await Promise.all([
    dialog.boundingBox(),
    page.locator('.chart-plot').boundingBox(),
  ]);
  expect(dialogBounds).not.toBeNull();
  expect(plotBounds).not.toBeNull();
  expect(dialogBounds!.y).toBeGreaterThanOrEqual(plotBounds!.y + plotBounds!.height - 1);
  const inspect = dialog.getByRole('button', { name: /Inspect call/ }).first();
  const inspectedCall = Number((await inspect.textContent())?.match(/\d+/)?.[0]);
  await inspect.click();
  await expect(page.locator(`#economics-call-${inspectedCall}`)).toBeFocused();
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();

  await endpointTrigger.locator('.event-hit').click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(endpointTrigger).toBeFocused();
  record('complete');
  await test.info().attach('dense-workspace-timings', {
    body: JSON.stringify(timings, null, 2),
    contentType: 'application/json',
  });
});

test('terminal summaries without calls remain selectable from the lifespan list', async ({
  page,
}) => {
  test.skip(integrated, 'This regression uses a deterministic terminal-summary fixture.');
  await mockApi(page, sessionScenario('terminalSummaryOnly'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TokenPlume' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No model calls' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Context lifespans · 1 item' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'Context River' })).toHaveCount(0);
  await page.locator('.lifespan-disclosure > summary').click();

  await page
    .getByRole('button', {
      name: 'Select Terminal compaction summary; no model-call presence',
    })
    .click();
  await expect(page.getByRole('heading', { name: 'Terminal compaction summary' })).toBeVisible();
  await expect(page.locator('.item-details')).toContainText('No model-call presence');
});

test('capture partial-estimate baseline screenshot', async ({ page }) => {
  const directory = process.env.TOKENPLUME_BASELINE_SCREENSHOTS;
  test.skip(integrated || !directory, 'Set TOKENPLUME_BASELINE_SCREENSHOTS to capture baselines.');
  await mockApi(page, sessionScenario('partialGeometry'));
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.locator('.session-quality')).toContainText('partial coverage');
  await expect(page.getByText('Token estimate caveat')).toHaveCount(0);
  await captureBaselineState(page, directory!, 'desktop-partial-estimates');
});

test('capture unavailable-geometry baseline screenshot', async ({ page }) => {
  const directory = process.env.TOKENPLUME_BASELINE_SCREENSHOTS;
  test.skip(integrated || !directory, 'Set TOKENPLUME_BASELINE_SCREENSHOTS to capture baselines.');
  await mockApi(page, sessionScenario('unavailableGeometry'));
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.locator('.session-quality')).toHaveText(
    'Token geometry unavailable · structural view',
  );
  await captureBaselineState(page, directory!, 'desktop-unavailable-geometry');
});

test('Escape collapses economics before item, pin and Fit all stages', async ({ page }) => {
  test.skip(integrated, 'Uses sanitized economics and isolated browser preferences.');
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  await page.getByRole('button', { name: 'bash: npm test', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Pin model call 1', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expandEconomics(page);
  await page.getByRole('button', { name: 'Share (%)', exact: true }).click();
  await page.keyboard.press('Escape');
  const trigger = page.getByRole('button', { name: 'Cache & cost', exact: true });
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.economics-track-svg')).toHaveCount(0);
  await expect(page.locator('#selected-item-summary')).toHaveText('bash: npm test');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  await page.keyboard.press('Escape');
  await expect(page.locator('#selected-item-summary')).toHaveCount(0);
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pinned-call-summary')).toHaveCount(0);
  await expect(page.locator('.zoom-level')).not.toHaveText('Zoom 1.0×');
  await page.keyboard.press('Escape');
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.0×');
  await expandEconomics(page);
  await expect(page.getByRole('button', { name: 'Share (%)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Cache & cost uses a borderless disclosure with stable naming and remembered keyboard toggles', async ({
  page,
}) => {
  test.skip(integrated, 'Uses isolated presentation preferences and a sanitized API.');
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  const trigger = page.getByRole('button', { name: 'Cache & cost', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger.locator('.disclosure-marker')).toHaveText('▸');
  const style = await trigger.evaluate((node) => ({
    border: getComputedStyle(node).borderTopWidth,
    background: getComputedStyle(node).backgroundColor,
    height: node.getBoundingClientRect().height,
  }));
  expect(style.border).toBe('0px');
  expect(style.background).toBe('rgba(0, 0, 0, 0)');
  expect(style.height).toBeGreaterThanOrEqual(28);
  await page.screenshot({
    path: '.playwright/calm-workspace/cache-cost-disclosure-collapsed.png',
    fullPage: true,
  });
  await trigger.hover();
  expect(await trigger.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await trigger.press('Space');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger.locator('.disclosure-marker')).toHaveText('▾');
  await page.screenshot({
    path: '.playwright/calm-workspace/cache-cost-disclosure-expanded.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Share (%)', exact: true }).click();
  await page.getByRole('button', { name: 'Cost', exact: true }).click();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.economics-track-svg')).toHaveCount(0);
  await trigger.press('Enter');
  await expect(page.getByRole('button', { name: 'Cost', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Cache', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share (%)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await trigger.press('Space');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('blocked storage leaves quiet controls usable without private persistence', async ({
  page,
}) => {
  test.skip(integrated, 'Uses sanitized API and blocked browser storage.');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked');
      },
    });
  });
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  await openViewOptions(page);
  await expect(page.getByRole('group', { name: 'River layout' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Visible calls', exact: true }).click();
  await expect(page.locator('.view-status')).toHaveText('Visible-call scale');
  await expandEconomics(page);
  await page.getByRole('button', { name: 'Cost', exact: true }).click();
  await expect(page.locator('.economics-track-svg')).toHaveAttribute('aria-label', /Cost track/);
  await page.reload();
  await assertLoaded(page);
  await expect(page.locator('.view-status')).toHaveCount(0);
  await expect(page.locator('.economics-track-svg')).toHaveCount(0);
});

test('retired Compact preference is ignored without losing scale, grouping or economics settings', async ({
  page,
}) => {
  test.skip(integrated, 'Uses seeded presentation preferences and a sanitized API.');
  const legacy = JSON.stringify({
    version: 1,
    river: { verticalScale: 'visible', layout: 'compact', display: 'itemTypes' },
    economics: { expanded: true, lastMode: 'cost', cacheView: 'share' },
  });
  await page.addInitScript(
    (value) => localStorage.setItem('tokenplume.presentation.v1', value),
    legacy,
  );
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.locator('.river-scroll .river-plot')).toHaveAttribute('height', '500');
  await expect(page.locator('.economics-track-svg')).toHaveAttribute('height', '222');
  await expect(page.locator('.view-status')).toHaveText('Visible-call scale · Item types');
  expect(await page.evaluate(() => localStorage.getItem('tokenplume.presentation.v1'))).toBe(
    legacy,
  );
  await openViewOptions(page);
  await expect(page.getByRole('group', { name: 'River layout' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compact River', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Balanced', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Items', exact: true }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tokenplume.presentation.v1')!),
  );
  expect(stored.river).toEqual({ verticalScale: 'visible', display: 'items' });
  expect(stored.economics).toEqual({ expanded: true, lastMode: 'cost', cacheView: 'share' });
  await page.getByRole('button', { name: 'Cache', exact: true }).click();
  await expect(page.locator('.economics-track-svg')).toHaveAttribute('height', '300');
  await expect(page.getByRole('button', { name: 'Share (%)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('empty inspector occupancy preserves fractional pan anchors and explicit range endpoints', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic long-session geometry.');
  await mockApi(page, sessionScenario('longSession'));
  await page.goto('/');
  await assertLoaded(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const host = page.getByTestId('river-host');
  const anchor = () =>
    host.evaluate((element) => {
      const svg = element.querySelector('svg')!;
      return (
        (element.scrollLeft + element.clientWidth / 2 - 42) /
        (Number(svg.getAttribute('width')) - 66)
      );
    });
  const select = async () => {
    await page
      .locator('.ribbon-hit')
      .first()
      .evaluate((node) => (node as SVGElement).focus({ preventScroll: true }));
    await page.keyboard.press('Enter');
  };
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await host.evaluate((element) => {
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  });
  const before = await anchor();
  await select();
  await expect(page.locator('.exploration-grid')).toHaveClass(/occupied/);
  await expect.poll(anchor).toBeCloseTo(before, 3);
  const occupiedWidth = (await host.boundingBox())!.width;
  await page
    .locator('.ribbon-hit')
    .nth(1)
    .evaluate((node) => (node as SVGElement).focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  expect((await host.boundingBox())!.width).toBeCloseTo(occupiedWidth, 1);
  await page.getByRole('button', { name: 'Close context item', exact: true }).click();
  await expect.poll(anchor).toBeCloseTo(before, 3);
  await restoreRiverRange(page, 80, 81);
  await select();
  for (const call of [80, 81]) {
    const bounds = await page
      .getByRole('button', { name: `Pin model call ${call}`, exact: true })
      .boundingBox();
    const viewport = (await host.boundingBox())!;
    expect(bounds!.x + bounds!.width / 2).toBeGreaterThanOrEqual(viewport.x);
    expect(bounds!.x + bounds!.width / 2).toBeLessThanOrEqual(viewport.x + viewport.width);
  }
});

test('inspector close controls align with the outer panel titles on desktop and narrow layouts', async ({
  page,
}) => {
  test.skip(integrated, 'Uses deterministic mocked analysis.');
  await mockApi(page);
  await page.goto('/');
  await assertLoaded(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'bash: npm test', exact: true }).click();
    for (const [name, title] of [
      ['Close pinned call', 'Model call'],
      ['Close context item', 'Context item'],
    ]) {
      const close = page.getByRole('button', { name, exact: true });
      const panel = page.locator('.inspector-column > .panel').filter({ has: close });
      const heading = panel.getByRole('heading', { name: title, exact: true });
      await close.scrollIntoViewIfNeeded();
      const buttonBounds = (await close.boundingBox())!;
      const headingBounds = (await heading.boundingBox())!;
      expect(Math.abs(buttonBounds.y - headingBounds.y)).toBeLessThan(5);
      expect(buttonBounds.x).toBeGreaterThan(headingBounds.x + headingBounds.width);
      await expect(
        panel.locator('.panel-head').getByRole('button', { name, exact: true }),
      ).toBeVisible();
    }
    await page.getByRole('button', { name: 'Close context item', exact: true }).click();
    await expect(page.locator('#selected-item-summary')).toHaveCount(0);
    await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
    await page.getByRole('button', { name: 'bash: npm test', exact: true }).click();
    await page.getByRole('button', { name: 'Close pinned call', exact: true }).click();
    await expect(page.locator('#pinned-call-summary')).toHaveCount(0);
    await expect(page.locator('#selected-item-summary')).toBeVisible();
    await page.getByRole('button', { name: 'Close context item', exact: true }).click();
  }
});

test('quiet defaults, explicit preferences, staged Escape and inspector remount preserve an investigation', async ({
  page,
}) => {
  test.skip(integrated, 'Uses sanitized API and isolated browser storage.');
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  const options = page.locator('.view-options');
  const host = page.getByTestId('river-host');
  await expect(options).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Cache & cost' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.locator('.economics-track-svg')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('tokenplume.presentation.v1'))).toBeNull();
  const emptyWidth = (await host.boundingBox())!.width;
  await page.getByRole('button', { name: 'bash: npm test', exact: true }).click();
  await page.getByRole('button', { name: 'Pin model call 1', exact: true }).click();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  const occupiedWidth = (await host.boundingBox())!.width;
  expect(emptyWidth - occupiedWidth).toBeGreaterThan(300);
  const item = page.locator('.item-details');
  await item.getByText('Technical identifiers', { exact: true }).click();
  await expect(item.locator('.technical-identifiers')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Close context item', exact: true }).click();
  await expect(page.locator('#selected-item-summary')).toHaveCount(0);
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await page.getByRole('button', { name: 'bash: npm test', exact: true }).press('Enter');
  await expect(item.locator('.technical-identifiers')).toHaveAttribute('open', '');
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  expect((await host.boundingBox())!.width).toBeCloseTo(occupiedWidth, 1);
  await openViewOptions(page);
  await page.getByRole('button', { name: 'Visible calls', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(options).not.toHaveAttribute('open', '');
  await expect(options.locator('summary')).toBeFocused();
  await expect(page.locator('#selected-item-summary')).toBeVisible();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(page.locator('.view-status')).toHaveText('Visible-call scale');
  await expandEconomics(page);
  await page.getByRole('button', { name: 'Share (%)', exact: true }).click();
  await page.locator('#economics-call-1').focus();
  await page.getByRole('button', { name: 'Off', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cache & cost' })).toBeFocused();
  await expandEconomics(page);
  await expect(page.getByRole('button', { name: 'Share (%)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await openViewOptions(page);
  await expect(page.getByLabel('Call number')).toBeVisible();
  await page.getByRole('tab', { name: 'Composition', exact: true }).click();
  await expect(options).not.toHaveAttribute('open', '');
  await expect(page.locator('.go-to-disclosure')).toHaveCount(0);
  await page.getByRole('tab', { name: 'River', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share (%)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await assertLoaded(page);
  await expect(page.locator('.view-status')).toHaveText('Visible-call scale');
  await expect(page.getByRole('button', { name: 'Share (%)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Navigation restores from the fragment, not from presentation storage.
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(page.locator('#selected-item-summary')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('tokenplume.presentation.v1')),
  ).not.toContain('browser-smoke');
  await openViewOptions(page);
  await expect(
    page.getByRole('button', { name: 'Reset view preferences', exact: true }),
  ).toHaveCount(0);
  const economicsBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('tokenplume.presentation.v1')!).economics,
  );
  await page.getByRole('button', { name: 'Session scale', exact: true }).click();
  await expect(page.locator('.view-status')).toHaveCount(0);
  await expect(page.locator('.economics-track-svg')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('tokenplume.presentation.v1')!).economics,
    ),
  ).toEqual(economicsBefore);
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await expect(page.locator('#selected-item-summary')).toBeVisible();
});

test('quiet workspace responsive evidence and actual rendered palette contrast', async ({
  page,
}) => {
  test.skip(integrated, 'Uses sanitized API and recorded viewport measurements.');
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  for (const width of [1440, 1280, 1100, 1050, 1024, 768, 390]) {
    await page.setViewportSize({
      width,
      height: width === 1440 ? 1000 : width === 390 ? 844 : 900,
    });
    await expect(page.getByRole('button', { name: 'Latest', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 1440)
      expect((await page.locator('.river-scroll .river-plot').boundingBox())!.y).toBeLessThan(400);
    if (process.env.TOKENPLUME_CALM_SCREENSHOTS)
      await captureBaselineState(
        page,
        process.env.TOKENPLUME_CALM_SCREENSHOTS,
        `${width}-empty-inspector`,
      );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'bash: npm test', exact: true }).click();
  await page.getByRole('button', { name: 'Pin model call 1', exact: true }).click();
  const inspectFirst = page
    .locator('.item-details')
    .getByRole('button', { name: 'Inspect first included call · 1', exact: true });
  await expect(inspectFirst).toHaveCount(0);
  await page.getByRole('button', { name: 'Pin model call 2', exact: true }).click();
  await expect(inspectFirst).toBeVisible();
  await inspectFirst.click();
  await expect(inspectFirst).toHaveCount(0);
  await expect(page.locator('#pinned-call-summary')).toBeFocused();
  await expect(page.locator('#pinned-call-summary')).toHaveText('Pinned call 1');
  await page.getByRole('button', { name: 'Close pinned call', exact: true }).click();
  await expect(inspectFirst).toBeVisible();
  await inspectFirst.click();
  await expect(inspectFirst).toHaveCount(0);
  const output = process.env.TOKENPLUME_CALM_SCREENSHOTS;
  if (output) await captureBaselineState(page, output, 'desktop-selected-pinned');
  await expandEconomics(page);
  const plotBackground = await page
    .locator('.plot-background')
    .evaluate((node) => getComputedStyle(node).fill);
  expect(plotBackground).toBe('rgb(19, 27, 33)');
  expect(
    await page
      .locator('.economics-track-svg')
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe(plotBackground);
  if (output) await captureBaselineState(page, output, 'desktop-economics-expanded');
  await page.locator('.item-details .item-diagnostics > summary').click();
  if (output) await captureBaselineState(page, output, 'desktop-diagnostics-expanded');
  await page.getByRole('tab', { name: 'Composition' }).click();
  if (output) await captureBaselineState(page, output, 'desktop-composition');
  expect(
    await page
      .locator('.composition-treemap')
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe(plotBackground);
  const textContrast = await page
    .locator('.composition-treemap g[role="option"] text')
    .evaluateAll((nodes) => {
      const luminance = (css: string) => {
        const components = css
          .match(/\d+/g)!
          .slice(0, 3)
          .map((n) => Number(n) / 255)
          .map((n) => (n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
        return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
      };
      return nodes.map((node) => {
        const fill = node.closest('g[role="option"]')!.querySelector('rect')!;
        const a = luminance(getComputedStyle(node).fill),
          b = luminance(getComputedStyle(fill).fill);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    });
  expect(textContrast.length).toBeGreaterThan(0);
  for (const ratio of textContrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
  await page.getByRole('tab', { name: 'River', exact: true }).click();
  await page.locator('.lifespan-disclosure > summary').click();
  if (output) await captureBaselineState(page, output, 'desktop-lifespans');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (output) await captureBaselineState(page, output, 'narrow-selected-pinned');
});

test('integrated Rust-served embedded app loads, selects, and navigates', async ({ page }) => {
  test.skip(!integrated, 'Run scripts/browser-smoke-integrated.sh for the embedded-server smoke.');
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  const analysisResponse = page.waitForResponse((response) => response.url().endsWith('/analysis'));
  const navigation = await page.goto('/');
  // Detect binaries serving a comparison checkout's stale frontend, not just a working app.
  expect(await navigation!.text()).toBe(
    readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8'),
  );
  const analysis = await (await analysisResponse).json();
  expect(analysis.schemaVersion).toBe(15);
  expect(analysis.economics.cacheReadEligibleCalls).toBe(8);
  expect(analysis.economics.supportedPolicyIds).toEqual(
    expect.arrayContaining(['openai-responses-cache-read-v1', 'anthropic-messages-cache-v1']),
  );
  expect(analysis.modelCalls[0].usage.cacheRead).toBe(3);
  expect(analysis.modelCalls[0].economics.promptTokens).toBe(14);
  expect(analysis.modelCalls[0].economics.cacheWriteStatus).toBe('notRetainedByPi');
  expect(analysis.modelCalls[4].economics.promptTokens).toBe(70);
  expect(analysis.modelCalls[4].economics.cacheWriteStatus).toBe('reported');
  await assertLoaded(page);
  await expect(page.getByRole('combobox', { name: 'Session' })).toHaveValue(/^pi-[0-9a-f]{12}$/);
  await expect(page).toHaveURL(/#session=pi-[0-9a-f]{12}/);
  const linkParams = new URLSearchParams(new URL(page.url()).hash.slice(1));
  expect(linkParams.has('tp')).toBe(false);
  expect(linkParams.has('v')).toBe(false);
  expect(linkParams.get('session')).toBe(
    await page.getByRole('combobox', { name: 'Session' }).inputValue(),
  );
  const chart = page.getByRole('application', { name: 'Context River' });
  await expect(page.getByTestId('visible-call-range')).toContainText('of');
  const ribbon = chart.locator('.ribbon-hit').first();
  await expect(ribbon).toBeVisible();
  await ribbon.click();
  await expect(ribbon).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');

  await expandEconomics(page);
  await page.getByRole('button', { name: 'Cache', exact: true }).click();
  await expect(page.locator('.economics-track-svg')).toBeVisible();
  await expect(page.locator('.cache-mark')).toHaveCount(8);
  await page.getByRole('button', { name: 'Clear selected item and pinned call' }).click();
  await page.getByRole('tab', { name: 'Composition' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cumulative context usage · Whole session' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'At call', exact: true }).click();
  await expect(page.getByText(/Pin a call to inspect its item estimates/)).toBeVisible();
  await page.getByRole('button', { name: 'Inspect latest call' }).click();
  await expect(page.getByRole('heading', { name: 'Context composition · Call 8' })).toBeVisible();
  await page.getByRole('button', { name: 'Cumulative', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cumulative context usage · Calls 1–8' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'At call', exact: true }).click();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const compositionItem = page.locator('.composition-list [role="option"]').first();
  await expect(compositionItem).toBeVisible();
  await compositionItem.click();
  await expect(page.getByRole('region', { name: 'Pinned call 8' })).toBeVisible();
  await expect(page.locator('.item-details h3')).not.toHaveText(
    'Select an item to inspect its context.',
  );

  await page.getByRole('tab', { name: 'River' }).click();
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Pinned call 8' })).toBeVisible();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  await page.reload();
  await assertLoaded(page);
  await expect(page.getByRole('region', { name: 'Pinned call 8' })).toBeVisible();
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#session=pi-[0-9a-f]{12}/);
  expect(pageErrors).toEqual([]);
});
