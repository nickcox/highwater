import { test, expect } from '@playwright/test';
import { chooseSession } from './session-picker';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const database = process.env.HIGHWATER_OPENCODE_FIXTURE;

async function checkDirectoryReplacement(page: import('@playwright/test').Page) {
  test.skip(!database, 'Synthetic embedded-server fixture only.');
  expect(basename(dirname(database!))).toBe('store');
  const sessions = await (await page.request.get('/api/sessions')).json();
  const entry = sessions.sessions.find(
    (session: { displayName: string }) => session.displayName === 'Synthetic OpenCode task',
  );
  const parent = dirname(database!);
  renameSync(parent, parent + '-retired');
  mkdirSync(parent);
  execFileSync('python3', [
    '-c',
    'import pathlib,sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.executescript(pathlib.Path(sys.argv[2]).read_text()); c.executescript(pathlib.Path(sys.argv[3]).read_text()); c.execute("UPDATE session SET title=\'Replacement OpenCode task\'"); c.commit(); c.close()',
    database!,
    fileURLToPath(new URL('../../../fixtures/opencode/legacy-schema.sql', import.meta.url)),
    fileURLToPath(new URL('../../../fixtures/opencode/simple.sql', import.meta.url)),
  ]);
  await expect
    .poll(
      async () => {
        const list = await (await page.request.get('/api/sessions')).json();
        return list.sessions.some(
          (session: { displayName: string }) => session.displayName === 'Replacement OpenCode task',
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await page.goto('/#session=' + entry.id);
  await expect(page.locator('.estimate-level')).toBeVisible();
  const before = (await page.request.get('/api/sessions')).headers()['etag'];
  execFileSync('python3', [
    '-c',
    "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute(\"UPDATE part SET data=replace(data,'Synthetic question','Synthetic fallback') WHERE id='prt_user'\"); c.commit(); c.close()",
    database!,
  ]);
  // Depending on the OS, the native watcher may still follow the retired
  // directory. Later part-only commits must remain visible with polling enabled.
  await expect
    .poll(async () => (await page.request.get('/api/sessions')).headers()['etag'], {
      timeout: 10_000,
    })
    .not.toBe(before);
}

test('integrated OpenCode mixed catalogue, harness filters, links and WAL refresh', async ({
  page,
}) => {
  test.skip(!database, 'Run scripts/browser-smoke-opencode-integrated.sh with synthetic fixtures.');
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  const navigation = await page.goto('/');
  expect(await navigation!.text()).toBe(
    readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8'),
  );
  const list = await (await page.request.get('/api/sessions')).json();
  const openCode = list.sessions.find(
    (session: { displayName: string }) => session.displayName === 'Synthetic OpenCode task',
  );
  expect(openCode.id).toMatch(/^opencode-[0-9a-f]{12}$/);
  expect(list.sessions.some((session: { harness: string }) => session.harness === 'pi')).toBe(true);
  const picker = page.getByRole('combobox', { name: 'Session' });
  await expect(picker).toHaveAttribute('data-session-id', /^pi-/);
  const original = (await picker.getAttribute('data-session-id'))!;
  const harness = page.getByRole('combobox', { name: 'Harness' });
  await expect(harness).toHaveValue('all');
  await harness.selectOption('opencode');
  await expect(picker).toHaveAttribute('data-session-id', original);
  const analysisResponse = page.waitForResponse(
    (response) => response.url().includes(openCode.id) && response.url().endsWith('/analysis'),
  );
  await chooseSession(page, openCode.id);
  const response = await analysisResponse;
  const analysis = await response.json();
  expect(analysis.schemaVersion).toBe(1);
  expect(analysis.session.source).toBe('opencode');
  expect(analysis.reconstruction.status).toBe('partial');
  await expect(page.locator('.estimate-level')).toBeVisible();
  // The summary shows one cost, or Unknown when no call has one.
  const costSummary = analysis.session.costSummary;
  await expect(page.locator('.cost-metric')).toContainText(
    costSummary.billed.calls + costSummary.apiEquivalent.calls > 0 ? 'Cost' : 'Unknown',
  );
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page).toHaveURL(/#session=opencode-/);
  const etag = response.headers()['etag'];
  const unchanged = await page.request.get(`/api/sessions/${openCode.id}/analysis`, {
    headers: { 'If-None-Match': etag },
  });
  expect(unchanged.status()).toBe(304);
  await page.getByRole('tab', { name: 'Composition' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cumulative context usage · Whole session' }),
  ).toBeVisible();
  await page.reload();
  await expect(picker).toHaveAttribute('data-session-id', openCode.id);
  await expect(page.getByRole('tab', { name: 'Composition' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await chooseSession(page, original);
  await expect(picker).toHaveAttribute('data-session-id', original);
  // The new session's history entry is written once its analysis loads.
  await expect(page).toHaveURL(new RegExp(`session=${original}&`));
  await page.goBack();
  await expect(picker).toHaveAttribute('data-session-id', openCode.id);
  await expect(page.locator('.estimate-level')).toBeVisible();
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().includes(openCode.id) &&
      response.url().endsWith('/analysis') &&
      response.status() === 200 &&
      response.headers()['etag'] !== etag,
  );
  execFileSync('python3', [
    '-c',
    "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute(\"UPDATE part SET data = replace(data, 'Synthetic question', 'Synthetic revision') WHERE id = 'prt_user'\"); c.commit(); c.close()",
    database!,
  ]);
  const changed = await refreshed;
  expect(changed.headers()['etag']).not.toBe(etag);
  const updated = await changed.json();
  expect(
    updated.contextItems.some((item: { preview: { text: string } }) =>
      item.preview.text.includes('Synthetic revision'),
    ),
  ).toBe(true);
  await expect(page.locator('.estimate-level')).toBeVisible();
  await page.getByRole('option', { name: /^User message,/ }).click();
  await page.locator('.item-details summary').filter({ hasText: 'Content preview' }).click();
  await expect(page.locator('.item-details').getByText(/Synthetic revision/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(harness).toBeVisible();
  await expect(picker).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  expect(pageErrors).toEqual([]);
});

test('integrated OpenCode modern checkpoints, usage-only calls and WAL refresh', async ({
  page,
}) => {
  test.skip(!database, 'Synthetic embedded-server fixture only.');
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  const list = await (await page.request.get('/api/sessions')).json();
  const modern = list.sessions.find(
    (session: { displayName: string }) => session.displayName === 'Synthetic modern task',
  );
  expect(modern).toBeTruthy();
  await page.goto('/#session=' + modern.id + '&pin=1');
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page.locator('#estimate-quality-note')).toContainText(
    'Some compaction records have no request usage',
  );
  const initial = await page.request.get(`/api/sessions/${modern.id}/analysis`);
  const analysis = await initial.json();
  expect(analysis.modelCalls).toHaveLength(3);
  expect(analysis.modelCalls[0].usage.recordedOutput).toBe(20);
  expect(analysis.modelCalls[0].usage.reasoning).toBe(5);
  expect(analysis.modelCalls[0].usage.outputReasoningRelationship).toBe('unknown');
  expect(analysis.modelCalls[0].reportedCompletionTokens).toBeNull();
  const pinned = page.getByRole('region', { name: 'Pinned call 1' });
  await expect(pinned.getByText('Recorded output', { exact: true }).locator('+ dd')).toHaveText(
    '20',
  );
  await expect(pinned.getByText('Recorded reasoning', { exact: true }).locator('+ dd')).toHaveText(
    '5',
  );
  await expect(pinned.locator('.essential-metrics')).not.toContainText('Unknown');
  expect(analysis.modelCalls[1].sourceRecordId).toBe('msg_empty');
  expect(analysis.compactions).toHaveLength(1);
  expect(analysis.compactions[0].retainedItemIds).toEqual([]);
  const river = page.getByRole('application', { name: 'Context River' });
  await river
    .getByRole('option', { name: /^Compaction checkpoint,/ })
    .or(river.getByRole('button', { name: 'Compaction checkpoint', exact: true }))
    .click();
  await page.locator('.item-details summary').filter({ hasText: 'Content preview' }).click();
  await page.locator('.item-details').getByRole('button', { name: 'Show more' }).click();
  await expect(
    page.locator('.item-details').getByText(/Synthetic serialized recent exchange/),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Composition' }).click();
  await expect(page.getByRole('heading', { name: /^Cumulative context usage ·/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Selected item in Composition' })).toBeVisible();
  const etag = initial.headers()['etag'];
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().includes(modern.id) &&
      response.url().endsWith('/analysis') &&
      response.status() === 200 &&
      response.headers()['etag'] !== etag,
  );
  execFileSync('python3', [
    '-c',
    "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute(\"UPDATE session_message SET data=replace(data,'Synthetic modern summary','Synthetic revised summary') WHERE id='msg_checkpoint'\"); c.commit(); c.close()",
    database!,
  ]);
  const updated = await (await refreshed).json();
  expect(
    updated.contextItems.some((item: { preview: { expandedText: string } | null }) =>
      item.preview?.expandedText.includes('Synthetic revised summary'),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('integrated OpenCode polling survives watched-directory replacement', async ({ page }) => {
  await checkDirectoryReplacement(page);
});
