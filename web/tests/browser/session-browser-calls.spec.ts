import { expect, test, type Page } from '@playwright/test';
import { generation, mockApi } from './mock-api';

const base = {
  harness: 'claude-code',
  fileName: 'test.jsonl',
  workingDirectory: '/tmp/TokenPlume',
  startedAt: '2026-11-28T01:00:00Z',
  modifiedAt: '2026-11-28T02:00:00Z',
  byteSize: 1,
};
const calls = (count: number, peakInput: number | null, ...models: [string, number][]) => ({
  count,
  peakInput,
  models: models.map(([model, calls]) => ({ model, calls })),
});

async function catalogue(page: Page) {
  await mockApi(page);
  await page.route('**/api/sessions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        etag: '"browser-calls"',
        'X-Highwater-Server-Generation': generation,
        'X-Highwater-Catalog-Revision': '0',
        'X-Highwater-Live-Updates': 'active',
      },
      body: JSON.stringify({
        sessions: [
          {
            ...base,
            id: 'browser-smoke',
            displayName: 'Review the session table',
            firstPrompt: 'Add Model, Calls and Peak input columns',
            total: {
              usd: 4.5,
              includesChildren: true,
              kind: 'recorded',
              partial: false,
              sinceMs: null,
            },
            calls: calls(312, 182_400, ['claude-opus-5-5', 300], ['claude-haiku-5-5', 12]),
          },
          {
            ...base,
            id: 'child',
            displayName: 'Explore',
            parentReference: 'browser-smoke',
            subagentType: 'Explore',
            calls: calls(40, 250_000, ['claude-sonnet-5-5', 40]),
          },
          {
            ...base,
            harness: 'pi',
            id: 'pi-1',
            displayName: 'Plan the release',
            modifiedAt: '2026-11-27T02:00:00Z',
            total: { usd: 1.2, kind: 'sum', partial: false, sinceMs: null },
            calls: calls(25, 61_000, ['gpt-6.1-sol', 25]),
          },
          {
            ...base,
            harness: 'opencode',
            id: 'opencode-1',
            displayName: 'Not yet read',
            modifiedAt: '2026-11-26T02:00:00Z',
          },
        ],
      }),
    }),
  );
}

const visibleHeaders = (page: Page) =>
  page
    .getByRole('grid', { name: 'Sessions' })
    .locator('th:visible')
    .evaluateAll((cells) => cells.map((cell) => cell.textContent?.replace(/ [↑↓]$/, '').trim()));

for (const [width, headers] of [
  [
    1500,
    [
      'Title',
      'Project',
      'Harness',
      'Model',
      'Last changed',
      'Duration',
      'Calls',
      'Peak input',
      'Cost',
    ],
  ],
  [1100, ['Title', 'Project', 'Model', 'Last changed', 'Calls', 'Cost']],
  [800, ['Title', 'Model', 'Last changed', 'Cost']],
  [500, ['Title', 'Last changed', 'Cost']],
] as const) {
  test(`session table shows its columns for the width at ${width}px`, async ({ page }) => {
    test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue.');
    await page.setViewportSize({ width, height: 900 });
    await catalogue(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^Session:/ }).click();
    await expect.poll(() => visibleHeaders(page)).toEqual(headers);
    const directory = process.env.HIGHWATER_BASELINE_SCREENSHOTS;
    if (directory)
      await page
        .getByRole('region', { name: 'Session browser' })
        .screenshot({ path: `${directory}/session-table-${width}.png` });
  });
}

test('call figures include hidden child sessions, sort and filter by model', async ({ page }) => {
  test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue.');
  await page.setViewportSize({ width: 1500, height: 900 });
  await catalogue(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Session:/ }).click();
  const grid = page.getByRole('grid', { name: 'Sessions' });
  const row = grid.locator('tbody tr').filter({ hasText: 'Review the session table' });
  const cells = row.locator('td');
  await expect(cells.nth(3)).toHaveText('claude-opus-5-5+2');
  await expect(cells.nth(3)).toHaveAttribute(
    'title',
    'claude-opus-5-5: 300 calls\nclaude-sonnet-5-5: 40 calls\nclaude-haiku-5-5: 12 calls\nIncludes 1 child session',
  );
  await expect(cells.nth(6)).toHaveText('352');
  await expect(cells.nth(7)).toHaveText('250K');
  await page.getByRole('checkbox', { name: 'Child sessions' }).check();
  await expect(cells.nth(3)).toHaveText('claude-opus-5-5+1');
  await expect(cells.nth(6)).toHaveText('312');
  await expect(cells.nth(7)).toHaveText('182.4K');
  await page.getByRole('checkbox', { name: 'Child sessions' }).uncheck();

  await page.getByRole('button', { name: /^Calls/ }).click();
  await expect(grid.locator('tbody tr').first()).toContainText('Review the session table');
  await expect(grid.locator('tbody tr').last()).toContainText('Not yet read');

  const model = page.getByRole('combobox', { name: 'Model' });
  await expect(model.locator('option')).toHaveText([
    'All models',
    'claude-haiku-5-5 (1)',
    'claude-opus-5-5 (1)',
    'claude-sonnet-5-5 (1)',
    'gpt-6.1-sol (1)',
  ]);
  await model.selectOption('claude-sonnet-5-5');
  await expect(grid.locator('tbody tr')).toHaveCount(1);
  await expect(grid.locator('tbody tr')).toContainText('Review the session table');
  await model.selectOption('gpt-6.1-sol');
  await expect(grid.locator('tbody tr')).toHaveText([/Plan the release/]);
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await page.getByRole('textbox', { name: 'Search sessions' }).fill('sol');
  await expect(grid.locator('tbody tr')).toHaveText([/Plan the release/]);
});
