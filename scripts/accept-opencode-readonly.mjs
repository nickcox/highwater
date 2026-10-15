#!/usr/bin/env node
// Opt-in real-source browser acceptance: no writes, traces, screenshots, or
// transcript/identifier diagnostics. The server opens the supplied SQLite DB RO.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, 'web/package.json'));
const { chromium } = require('@playwright/test');
const databases = process.argv.slice(2);
if (!databases.length) throw new Error('Supply explicit read-only OpenCode database paths.');
const temporary = await mkdtemp(join(tmpdir(), 'highwater-readonly-browser-'));
await mkdir(join(temporary, 'pi'));
const socket = createServer();
await new Promise((done) => socket.listen(0, '127.0.0.1', done));
const port = socket.address().port;
await new Promise((done) => socket.close(done));
const server = spawn(join(root, 'target/release/highwater'), ['--session-root', join(temporary, 'pi'), ...databases.flatMap((database) => ['--opencode-db', resolve(database)]), '--port', String(port), '--tokenization', 'heuristic'], { stdio: 'ignore' });
let spawnFailed = false;
server.on('error', () => { spawnFailed = true; });
const running = () => server.pid !== undefined && server.exitCode === null && server.signalCode === null;
const base = `http://127.0.0.1:${port}`;
let browser;
try {
  let sessions;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (spawnFailed || !running()) throw new Error('server readiness');
    try {
      const response = await fetch(base + '/api/sessions');
      if (response.ok) { sessions = (await response.json()).sessions; break; }
    } catch {}
    await new Promise((done) => setTimeout(done, 50));
  }
  if (!sessions?.length) throw new Error('source catalogue');
  let selected;
  let rejected = 0;
  for (const session of sessions) {
    const response = await fetch(base + '/api/sessions/' + session.id + '/analysis');
    if (response.ok) {
      const analysis = await response.json();
      if (analysis.modelCalls.length && analysis.contextItems.length) { selected = session; break; }
    } else { rejected++; }
  }
  if (!selected) throw new Error('qualified source');
  browser = await chromium.launch();
  const page = await browser.newPage();
  let errors = 0;
  page.on('pageerror', () => errors++);
  await page.goto(base + '/#session=' + selected.id);
  await page.getByRole('complementary', { name: 'Reconstruction coverage' }).waitFor();
  await page.getByRole('application', { name: 'Context River' }).waitFor();
  await page.getByRole('tab', { name: 'Composition' }).click();
  await page.getByRole('region', { name: 'Context composition' }).waitFor();
  await page.reload();
  await page.getByRole('region', { name: 'Context composition' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: 'Harness' }).waitFor();
  await new Promise((done) => setTimeout(done, 300));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('narrow layout');
  if (errors) throw new Error('page errors');
  console.log(`readonly_browser catalogue_sessions=${sessions.length} skipped_before_selection=${rejected} river=true composition=true reload=true narrow=true page_errors=0`);
} catch {
  // Intentionally no exception, URL, HTML, screenshot or private content dump.
  console.error('read-only OpenCode browser acceptance failed');
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (running()) {
    server.kill('SIGINT');
    await Promise.race([new Promise((done) => server.once('exit', done)), new Promise((done) => setTimeout(done, 5000))]);
    if (running()) { server.kill('SIGKILL'); await new Promise((done) => server.once('exit', done)); }
  }
  await rm(temporary, { recursive: true, force: true });
}
