import { test, expect } from '@playwright/test';
import { chooseSession } from './session-picker';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const projects = process.env.TOKENPLUME_CLAUDE_CODE_FIXTURE;

interface Listed {
  id: string;
  displayName: string;
  harness: string;
  parentReference?: string | null;
  subagentType?: string;
}

async function listed(page: import('@playwright/test').Page): Promise<Listed[]> {
  return (await (await page.request.get('/api/sessions')).json()).sessions;
}

test('integrated Claude Code catalogue, coverage, costs and subagents', async ({ page }) => {
  test.skip(
    !projects,
    'Run scripts/browser-smoke-claude-code-integrated.sh with synthetic fixtures.',
  );
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('/');
  const sessions = await listed(page);
  const claudeCode = sessions.filter((session) => session.harness === 'claude-code');
  expect(claudeCode).toHaveLength(18);
  expect(sessions.some((session) => session.harness === 'pi')).toBe(true);
  for (const session of claudeCode) expect(session.id).toMatch(/^claude-code-[0-9a-f]{12}$/);
  const compaction = claudeCode.find((session) => session.displayName === 'project · 00000006')!;
  const subagent = claudeCode.find((session) => session.subagentType === 'statusline-setup')!;
  expect(subagent.displayName).toBe('Configure the status line');
  expect(subagent.parentReference).toBe(
    claudeCode.find((session) => session.displayName === 'project · 00000016')!.id,
  );

  const harness = page.getByRole('combobox', { name: 'Harness' });
  const picker = page.getByRole('combobox', { name: 'Session' });
  await harness.selectOption('claude-code');
  await picker.click();
  await expect(
    page.getByRole('option', {
      name: /^Configure the status line · .*child session · statusline-setup$/,
    }),
  ).toBeAttached();
  const analysisResponse = page.waitForResponse(
    (response) => response.url().includes(compaction.id) && response.url().endsWith('/analysis'),
  );
  await chooseSession(page, compaction.id);
  const response = await analysisResponse;
  expect(response.status()).toBe(200);
  const analysis = await response.json();
  expect(analysis.schemaVersion).toBe(16);
  expect(analysis.session.source).toBe('claude-code');
  expect(analysis.modelCalls).toHaveLength(4);
  expect(analysis.compactions).toHaveLength(1);
  const coverage = page.getByRole('complementary', { name: 'Reconstruction coverage' });
  await expect(coverage).toContainText("The harness's own model calls");
  await expect(coverage).toContainText('Some compaction records have no request usage');
  await expect(page.locator('.cost-metric')).toContainText('Cost');
  await expect(page.locator('.cost-metric')).not.toContainText('covered by a subscription');
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  const river = page.getByRole('application', { name: 'Context River' });
  await river
    .getByRole('option', { name: /^Compaction summary,/ })
    .or(river.getByRole('button', { name: 'Compaction summary', exact: true }))
    .click();
  await expect(page.locator('.item-details')).toContainText('Compaction summary');
  await page.getByRole('tab', { name: 'Composition' }).click();
  await expect(page.getByRole('heading', { name: /^Cumulative context usage ·/ })).toBeVisible();
  const unchanged = await page.request.get(`/api/sessions/${compaction.id}/analysis`, {
    headers: { 'If-None-Match': response.headers()['etag'] },
  });
  expect(unchanged.status()).toBe(304);

  const withTotal = claudeCode.find((session) => session.displayName === 'project · 00000014')!;
  await chooseSession(page, withTotal.id);
  await page.locator('#session-details summary').click();
  await expect(page.locator('#session-details')).toContainText("Claude Code's own total (USD)");
  await expect(page.locator('#session-details')).toContainText(
    "includes subagents and Claude Code's own calls, which are not in this transcript",
  );
  await expect(page.locator('#session-details')).toContainText('None: Claude Code records no cost');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(harness).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  expect(pageErrors).toEqual([]);
});

test('integrated Claude Code refreshes a transcript that is still being written', async ({
  page,
}) => {
  test.skip(!projects, 'Synthetic embedded-server fixture only.');
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  const simple = (await listed(page)).find(
    (session) => session.displayName === 'Synthetic greeting',
  )!;
  await page.goto('/#session=' + simple.id);
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  const refreshed = page.waitForResponse(
    async (response) =>
      response.url().includes(simple.id) &&
      response.url().endsWith('/analysis') &&
      response.status() === 200 &&
      (await response.json()).modelCalls.length === 2,
  );
  const session = '00000001-0000-4000-8000-000000000000';
  const common = `"cwd":"/synthetic/project","sessionId":"${session}","version":"2.1.287"`;
  appendFileSync(
    join(projects!, '-synthetic-project/simple.jsonl'),
    `{"type":"user","uuid":"s1-u2","parentUuid":"s1-a1",${common},"timestamp":"2026-10-01T00:01:00.000Z","message":{"role":"user","content":"And again."}}\n` +
      `{"type":"assistant","uuid":"s1-a2","parentUuid":"s1-u2",${common},"timestamp":"2026-10-01T00:01:01.000Z","message":{"id":"msg_s1_2","model":"claude-opus-5-5","role":"assistant","content":[{"type":"text","text":"Hello again."}],"stop_reason":"end_turn","usage":{"input_tokens":1,"cache_read_input_tokens":100,"cache_creation_input_tokens":10,"output_tokens":3}}}\n`,
  );
  await refreshed;
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  expect(errors).toEqual([]);
});
