import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { testAnalysis } from '../../src/lib/context-river/test-data';
import { compositionScenario } from '../../src/lib/testing/composition-scenarios';
import { sessionScenario } from '../../src/lib/testing/session-scenarios';

const integrated = process.env.TOKENPLUME_BROWSER_INTEGRATED === '1';
const generation = '0123456789abcdef0123456789abcdef';

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

async function captureBaselineState(page: Page, directory: string, name: string): Promise<void> {
  const output = resolve(directory);
  mkdirSync(output, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
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
  const otherRibbon = page.locator('.ribbon-group:not(.selected)').first();
  await expect
    .poll(() => otherRibbon.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('0.88');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');
  expect(pageErrors).toEqual([]);
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
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(1100);
  expect(
    await page.locator('[data-lifespan-item-id="composition-item-010"] .item-label').textContent(),
  ).toBe('Read · alpha/src/config.ts');
  await expect(page.locator('[data-lifespan-item-id="composition-item-010"]')).toHaveAttribute(
    'aria-label',
    /repo\/packages\/alpha\/src\/config\.ts/,
  );
  const expandedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(expandedHeight).toBeGreaterThan(collapsedHeight);

  await page.getByRole('combobox', { name: 'Sort items' }).selectOption('firstAppearance');
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(1100);
  await page.getByRole('combobox', { name: 'Sort items' }).selectOption('tokenTurns');

  const search = page.getByRole('searchbox', { name: 'Search items' });
  await search.fill('Composition item 1099');
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(1);
  await expect(page.locator('.result-count')).toHaveText('1 of 1,100 items');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(1100);

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
  await expect(page.locator('.lifespan-panel .row')).toHaveCount(1100);

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

test('scrolling inspector diagnostics retains call/item identity and return actions', async ({
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
  await diagnostics.locator('summary').click();
  expect(await inspector.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await inspector.evaluate((element) => (element.scrollTop = element.scrollHeight));
  await expect(page.getByRole('heading', { name: 'bash: npm test' })).toBeVisible();
  const back = page.getByRole('button', { name: 'Back to item summary' });
  await expect(back).toBeVisible();
  await back.click();
  await expect(diagnostics).not.toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: 'bash: npm test' })).toBeFocused();

  await inspector.evaluate((element) => (element.scrollTop = element.scrollHeight));
  await page.locator('[data-lifespan-item-id="retained"] .segment').first().click();
  await expect(page.getByRole('heading', { name: 'retained tail' })).toBeVisible();
  await expect(back).toBeVisible();

  await inspector.evaluate((element) => (element.scrollTop = 0));
  await expect(page.getByRole('heading', { name: 'Model call' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pinned call' })).toBeVisible();
});

test('cache and cost tracks share the river axis and expose a ratio change', async ({ page }) => {
  test.skip(integrated, 'This track regression uses deterministic mocked economics data.');
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);

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
  await expect(page.getByText(/Pi-calculated cost per call/)).toBeVisible();
  expect(await host.evaluate((element) => element.scrollLeft)).toBe(scrollLeft);
  expect(await track.getAttribute('width')).toBe(
    await river.locator('svg').first().getAttribute('width'),
  );
  await expect(page.locator('#economics-call-1')).toHaveAttribute('aria-label', /0\.0000000123/);
  await page.getByRole('button', { name: 'Off', exact: true }).click();
  await expect(track).toHaveCount(0);
});

test('cache share and grouped River views preserve exact identities', async ({ page }) => {
  test.skip(
    integrated,
    'This cache presentation regression uses deterministic mocked economics data.',
  );
  await mockApi(page, economicsScenario());
  await page.goto('/');
  await assertLoaded(page);

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
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Context lifespans · 4 items' })).toBeVisible();
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
  test.setTimeout(60_000);
  test.skip(integrated, 'This dense layout regression uses a deterministic sanitized analysis.');
  await mockApi(page, denseEconomicsScenario());
  await page.goto('/');
  await assertLoaded(page);
  await page.locator('.ribbon-hit').first().click();
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();

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

  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(page.locator('.quality-indicator')).toContainText('partial coverage');
  await expect(page.getByText('Token estimate caveat')).toHaveCount(0);
  await captureBaselineState(page, directory!, 'desktop-partial-estimates');
});

test('capture unavailable-geometry baseline screenshot', async ({ page }) => {
  const directory = process.env.TOKENPLUME_BASELINE_SCREENSHOTS;
  test.skip(integrated || !directory, 'Set TOKENPLUME_BASELINE_SCREENSHOTS to capture baselines.');
  await mockApi(page, sessionScenario('unavailableGeometry'));
  await page.goto('/');
  await assertLoaded(page);
  await expect(page.locator('.quality-indicator')).toHaveText(
    'Token geometry unavailable · structural view',
  );
  await captureBaselineState(page, directory!, 'desktop-unavailable-geometry');
});

test('integrated Rust-served embedded app loads, selects, and navigates', async ({ page }) => {
  test.skip(!integrated, 'Run scripts/browser-smoke-integrated.sh for the embedded-server smoke.');
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  const analysisResponse = page.waitForResponse((response) => response.url().endsWith('/analysis'));
  await page.goto('/');
  const analysis = await (await analysisResponse).json();
  expect(analysis.schemaVersion).toBe(7);
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
  const chart = page.getByRole('application', { name: 'Context River' });
  await expect(page.getByTestId('visible-call-range')).toContainText('of');
  const ribbon = chart.locator('.ribbon-hit').first();
  await expect(ribbon).toBeVisible();
  await ribbon.click();
  await expect(ribbon).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Selected item', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.zoom-level')).toHaveText('Zoom 1.5×');

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
  expect(pageErrors).toEqual([]);
});
