import { expect, test } from '@playwright/test';
import { generation, mockApi } from './mock-api';
test('hidden child costs are combined and cost filters use the combined amount', async ({
  page,
}) => {
  test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue.');
  await mockApi(page);
  const base = {
    harness: 'codex',
    fileName: 'test.jsonl',
    workingDirectory: '/tmp/project',
    startedAt: null,
    modifiedAt: null,
    byteSize: 1,
  };
  const total = (usd: number) => ({ usd, kind: 'estimated', partial: false, sinceMs: null });
  await page.route('**/api/sessions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        etag: '"browser-costs"',
        'X-Highwater-Server-Generation': generation,
        'X-Highwater-Catalog-Revision': '0',
        'X-Highwater-Live-Updates': 'active',
      },
      body: JSON.stringify({
        sessions: [
          { ...base, id: 'browser-smoke', displayName: 'Parent', total: total(0.75) },
          {
            ...base,
            id: 'child',
            displayName: 'Child',
            parentReference: 'browser-smoke',
            total: total(0.5),
          },
        ],
      }),
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /^Session:/ }).click();
  const grid = page.getByRole('grid', { name: 'Sessions' });
  await expect(grid).toContainText('~$1.25');
  await expect(grid).toContainText('$0.75 own + $0.50 from 1 child sessions');
  await page.getByLabel('Cost', { exact: true }).selectOption('over1');
  await expect(grid.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Child sessions' }).check();
  await expect(grid.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(grid.locator('tbody tr')).toHaveCount(2);
  await grid.locator('tbody tr').filter({ hasText: 'Child' }).click();
  await expect(page.getByRole('button', { name: /^Session:/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByRole('button', { name: /^Session:/ })).toHaveAttribute(
    'data-session-id',
    'child',
  );
});
