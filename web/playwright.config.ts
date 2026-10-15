import { defineConfig } from '@playwright/test';

const integrated = process.env.HIGHWATER_BROWSER_INTEGRATED === '1';
const baseURL = process.env.HIGHWATER_BROWSER_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: '../.playwright/test-results',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  ...(integrated
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }),
});
