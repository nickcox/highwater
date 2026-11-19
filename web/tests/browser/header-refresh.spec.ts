import { expect, test } from '@playwright/test';
import { generation, mockApi } from './mock-api';

for (const width of [500, 1280]) {
  test(`catalogue refresh keeps the header stable at ${width}px`, async ({ page }) => {
    test.skip(process.env.HIGHWATER_BROWSER_INTEGRATED === '1', 'Uses a mocked catalogue refresh.');
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto('/');
    await expect(page.getByTestId('live-status')).toHaveText('Live updates: live');
    await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
    const header = page.locator('.titlebar');
    const status = header.locator('.status-row');
    const detail = header.locator('.session-detail');
    await expect(detail).toContainText('/tmp/highwater-browser-smoke');
    const initialHeight = (await header.boundingBox())!.height;
    const initialWidth = (await detail.boundingBox())!.width;
    const initialStatus = await status.innerText();

    let finishRefresh!: () => void;
    const refresh = new Promise<void>((resolve) => (finishRefresh = resolve));
    await page.route('**/api/sessions', async (route) => {
      await refresh;
      await route.fulfill({
        status: 304,
        headers: {
          etag: '"catalog-v0"',
          'X-Highwater-Server-Generation': generation,
          'X-Highwater-Catalog-Revision': '1',
          'X-Highwater-Live-Updates': 'active',
        },
      });
    });
    const requested = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/sessions',
    );
    const responded = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/sessions',
    );
    await page.evaluate((generation) => {
      window.dispatchEvent(
        new MessageEvent('mockSessionsChanged', {
          data: JSON.stringify({ generation, revision: '1' }),
        }),
      );
    }, generation);
    try {
      await requested;
      await expect(status).toHaveText(initialStatus);
      expect((await detail.boundingBox())!.width).toBe(initialWidth);
      expect((await header.boundingBox())!.height).toBe(initialHeight);
    } finally {
      finishRefresh();
    }
    await responded;
    await expect(status).toHaveText(initialStatus);
  });
}
