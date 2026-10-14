import { test, expect } from '@playwright/test';
import { chooseSession } from './session-picker';

const userFolder = process.env.TOKENPLUME_VSCODE_COPILOT_FIXTURE;

interface Listed {
  id: string;
  displayName: string;
  harness: string;
  workingDirectory: string | null;
}

test('integrated VS Code Copilot catalogue, trace records, cost and timing', async ({ page }) => {
  test.skip(
    !userFolder,
    'Run scripts/browser-smoke-vscode-copilot-integrated.sh with synthetic fixtures.',
  );
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('/');
  const sessions: Listed[] = (await (await page.request.get('/api/sessions')).json()).sessions;
  const copilot = sessions.filter((session) => session.harness === 'vscode-copilot');
  // The empty session is not offered.
  expect(copilot.map((session) => session.displayName).sort()).toEqual([
    'Fix the failing parser test',
    'Summarise the service',
    'What does git rebase --onto do?',
  ]);
  for (const session of copilot) expect(session.id).toMatch(/^vscode-copilot-[0-9a-f]{12}$/);
  const agent = copilot.find((session) => session.displayName === 'Fix the failing parser test')!;
  expect(agent.workingDirectory).toBe('/home/dev/my project');

  await page.getByRole('combobox', { name: 'Harness' }).selectOption('vscode-copilot');
  const analysisResponse = page.waitForResponse(
    (response) => response.url().includes(agent.id) && response.url().endsWith('/analysis'),
  );
  await chooseSession(page, agent.id);
  const response = await analysisResponse;
  expect(response.status()).toBe(200);
  const analysis = await response.json();
  expect(analysis.session.source).toBe('vscode-copilot');
  expect(analysis.modelCalls).toHaveLength(3);
  // The first request's two calls have trace records; the second request's call does not.
  expect(analysis.modelCalls[0].timing.basis).toBe('vscode-copilot-trace-spans');
  expect(analysis.modelCalls[2].timing.basis).toBeNull();
  expect(analysis.contextItems.some((item: { kind: string }) => item.kind === 'system')).toBe(true);
  await expect(page.locator('#estimate-quality-note')).toContainText(
    'Some calls have no Copilot trace record',
  );

  await page.getByRole('button', { name: 'Pin model call 1', exact: true }).press('Enter');
  const details = page.locator('.call-details');
  await expect(details).toContainText('github-copilot / gpt-6-luna');
  await expect(details).toContainText('Response time');
  await expect(details).toContainText('$0.0005');
  await expect(details).toContainText('Recorded');

  await page.getByRole('button', { name: 'Pin model call 3', exact: true }).press('Enter');
  await expect(page.locator('.call-details')).toContainText('Not recorded');

  // A Claude call through Copilot, with cache reads and writes.
  const remote = copilot.find((session) => session.displayName === 'Summarise the service')!;
  const remoteResponse = page.waitForResponse(
    (candidate) => candidate.url().includes(remote.id) && candidate.url().endsWith('/analysis'),
  );
  await chooseSession(page, remote.id);
  const remoteAnalysis = await (await remoteResponse).json();
  expect(remoteAnalysis.modelCalls[0].economics.policyId).toBe('github-copilot-messages-cache-v1');
  await expect(page.getByRole('application', { name: 'Context River' })).toBeVisible();
  await expect(page.getByText('Could not render this session')).toHaveCount(0);

  const unchanged = await page.request.get(`/api/sessions/${agent.id}/analysis`, {
    headers: { 'If-None-Match': response.headers()['etag'] },
  });
  expect(unchanged.status()).toBe(304);
  expect(pageErrors).toEqual([]);
});
