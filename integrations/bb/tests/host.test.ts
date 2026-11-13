import { gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { experimental_createHostEntryHarness } from '@get-bb/plugin-sdk/testing/host';
import { createHighwaterEntry } from '../host';
import {
  binaries,
  expectedVersion,
  claudeFixtures,
  tempDirectory,
  writePi,
  analysis,
  response,
  deferred,
} from './helpers';
import type { AnalysisOptions } from '../host/analysis';

const harnesses: ReturnType<
  typeof experimental_createHostEntryHarness<
    ReturnType<typeof createHighwaterEntry>['contract'],
    {}
  >
>[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const harness of harnesses.splice(0)) await harness.experimental_dispose();
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
async function setup(binary: string, options: AnalysisOptions = {}) {
  const home = await tempDirectory();
  directories.push(home);
  await writePi(home);
  await writePi(home, 'broken-session', true);
  await claudeFixtures(home);
  const entry = createHighwaterEntry({
    process: { home, env: { PATH: process.env.PATH } },
    analysis: { pieceBytes: 64, ...options },
  });
  const harness = experimental_createHostEntryHarness(entry, {
    experimental_paths: { dataDir: join(home, 'data'), tempDir: join(home, 'tmp') },
  });
  harnesses.push(harness);
  return { harness, binaryPath: binary };
}

it('shares startup, catalogue validation and analysis across row/tab callers, with independent ETags', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      String(url).endsWith('/api/sessions')
        ? response({ sessions: [{ id: 'pi-probe', harness: 'pi', fileName: 'probe-main.jsonl' }] })
        : response(analysis()),
    );
  const { harness, binaryPath } = await setup(binaries[0], { fetcher });
  const input = { binaryPath, sessionId: 'pi-probe', ifNoneMatch: null };
  const [tab, row] = await Promise.all([
    harness.experimental_call('openAnalysis', { ...input, ifNoneMatch: '"v1"' }),
    harness.experimental_call('summary', input),
  ]);
  expect(tab).toEqual({ status: 'notModified', etag: '"v1"' });
  expect(row).toMatchObject({ status: 'ok', summary: { callCount: 3 } });
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/analysis'))).toHaveLength(1);
});

it('keeps another caller working when a host RPC is cancelled during a shared fetch', async () => {
  const started = deferred<void>();
  const pending = deferred<Response>();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).endsWith('/api/sessions'))
      return response({
        sessions: [{ id: 'pi-probe', harness: 'pi', fileName: 'probe-main.jsonl' }],
      });
    started.resolve();
    return pending.promise;
  });
  const { harness, binaryPath } = await setup(binaries[0], { fetcher });
  const input = { binaryPath, sessionId: 'pi-probe', ifNoneMatch: null };
  const controller = new AbortController();
  const first = harness.experimental_call('openAnalysis', input, { signal: controller.signal });
  const rejected = expect(first).rejects.toThrow();
  const other = harness.experimental_call('summary', input);
  await started.promise;
  controller.abort();
  pending.resolve(response(analysis()));
  await rejected;
  expect(await other).toMatchObject({ status: 'ok' });
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/analysis'))).toHaveLength(1);
});

it('transfers a real 4 MiB piece through the SDK JSON result limit', async () => {
  const payload = { ...analysis(), padding: randomBytes(6 * 1024 * 1024).toString('base64') };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) =>
    String(url).endsWith('/api/sessions')
      ? response({
          sessions: [
            {
              id: 'pi-probe',
              harness: 'pi',
              fileName: 'probe-main.jsonl',
              parentReference: null,
            },
          ],
        })
      : response(payload),
  );
  const { harness, binaryPath } = await setup(binaries[0], {
    fetcher,
    pieceBytes: 4 * 1024 * 1024,
  });
  const result = await harness.experimental_call('openAnalysis', {
    binaryPath,
    sessionId: 'pi-probe',
    ifNoneMatch: null,
  });
  expect(result.status).toBe('ok');
  if (result.status !== 'ok') throw new Error('Large transfer was not opened');
  expect(result.pieceCount).toBeGreaterThan(1);
  expect(Buffer.from(result.firstPiece, 'base64').length).toBe(4 * 1024 * 1024);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(8 * 1024 * 1024);
  const remaining = await harness.experimental_call('readAnalysisPiece', {
    transferId: result.transferId,
    index: 1,
  });
  expect(remaining).toHaveProperty('piece');
  await harness.experimental_dispose();
  expect(harness.experimental_lifecycleSignal.aborted).toBe(true);
});

describe.each(binaries)('host RPC with real binary %s', (binary) => {
  it('starts, finds only main sessions, transfers a complete analysis and revalidates summaries', async () => {
    const { harness, binaryPath } = await setup(binary);
    expect(await harness.experimental_call('status', { binaryPath })).toMatchObject({
      state: 'ready',
      version: expectedVersion,
    });
    const session = await harness.experimental_call('findSession', {
      binaryPath,
      harness: 'pi',
      providerThreadId: 'probe-main',
    });
    expect(session).toMatchObject({ found: true });
    if (!('found' in session) || !session.found) throw new Error('Fixture was not found');
    const input = { binaryPath, sessionId: session.sessionId, ifNoneMatch: null };
    const first = await harness.experimental_call('openAnalysis', input);
    expect(first.status).toBe('ok');
    if (first.status !== 'ok') throw new Error('Analysis transfer was not opened');
    expect(first.pieceCount).toBeGreaterThan(1);
    const pieces = [Buffer.from(first.firstPiece, 'base64')];
    for (let index = 1; index < first.pieceCount; index++) {
      const piece = await harness.experimental_call('readAnalysisPiece', {
        transferId: first.transferId,
        index,
      });
      if (!('piece' in piece)) throw new Error('Active transfer unexpectedly expired');
      pieces.push(Buffer.from(piece.piece, 'base64'));
    }
    const analysis = JSON.parse(gunzipSync(Buffer.concat(pieces)).toString('utf8'));
    expect(analysis.schemaVersion).toBe(1);
    const summary = await harness.experimental_call('summary', input);
    expect(summary.status).toBe('ok');
    if (summary.status === 'ok') expect(summary.summary.callCount).toBe(analysis.modelCalls.length);
    expect(
      await harness.experimental_call('openAnalysis', { ...input, ifNoneMatch: first.etag }),
    ).toEqual({ status: 'notModified', etag: first.etag });
    expect(
      await harness.experimental_call('summary', { ...input, ifNoneMatch: first.etag }),
    ).toEqual({ status: 'notModified', etag: first.etag });
    expect(
      await harness.experimental_call('closeAnalysisTransfer', { transferId: first.transferId }),
    ).toEqual({ closed: true });
    expect(
      await harness.experimental_call('readAnalysisPiece', {
        transferId: first.transferId,
        index: 0,
      }),
    ).toEqual({ expired: true });
    expect(
      await harness.experimental_call('findSession', {
        binaryPath,
        harness: 'pi',
        providerThreadId: 'absent',
      }),
    ).toEqual({ found: false });
    const claude = await harness.experimental_call('findSession', {
      binaryPath,
      harness: 'claude-code',
      providerThreadId: 'simple',
    });
    expect(claude).toMatchObject({ found: true });
    if (!('found' in claude) || !claude.found) throw new Error('Claude fixture was not found');
    const claudeInput = { binaryPath, sessionId: claude.sessionId, ifNoneMatch: null };
    expect(await harness.experimental_call('summary', claudeInput)).toMatchObject({
      status: 'ok',
      summary: { partial: true },
    });
    const claudeAnalysis = await harness.experimental_call('openAnalysis', claudeInput);
    expect(claudeAnalysis.status).toBe('ok');
    if (claudeAnalysis.status === 'ok')
      await harness.experimental_call('closeAnalysisTransfer', {
        transferId: claudeAnalysis.transferId,
      });
    const broken = await harness.experimental_call('findSession', {
      binaryPath,
      harness: 'pi',
      providerThreadId: 'broken-session',
    });
    if (!('found' in broken) || !broken.found)
      throw new Error('Malformed fixture was not catalogued');
    expect(
      await harness.experimental_call('openAnalysis', { ...input, sessionId: broken.sessionId }),
    ).toMatchObject({ status: 'error', httpStatus: 422, code: 'SESSION_PARSE_FAILED' });
    expect(
      await harness.experimental_call('findSession', {
        binaryPath,
        harness: 'claude-code',
        providerThreadId: 'agent-a16',
      }),
    ).toEqual({ found: false });
    expect(
      await harness.experimental_call('openAnalysis', {
        ...input,
        sessionId: 'pi-not-in-catalogue',
      }),
    ).toMatchObject({ status: 'error', httpStatus: 404, code: 'SESSION_NOT_FOUND' });
    await expect(
      harness.experimental_call('openAnalysis', { ...input, sessionId: '../etc/passwd' }),
    ).rejects.toThrow();
    await expect(
      harness.experimental_call('readAnalysisPiece', { transferId: first.transferId, index: -1 }),
    ).rejects.toThrow();
    await expect(
      harness.experimental_call('findSession', {
        binaryPath,
        harness: 'opencode' as 'pi',
        providerThreadId: 'not-enabled',
      }),
    ).rejects.toThrow();
  });
  it('returns typed errors instead of confusing binary failures with missing sessions', async () => {
    const { harness } = await setup(binary);
    const binaryPath = join(directories.at(-1)!, 'missing-binary');
    expect(await harness.experimental_call('status', { binaryPath })).toEqual({ state: 'missing' });
    expect(
      await harness.experimental_call('findSession', {
        binaryPath,
        harness: 'pi',
        providerThreadId: 'probe-main',
      }),
    ).toMatchObject({ status: 'error', code: 'binaryMissing' });
    expect(
      await harness.experimental_call('summary', {
        binaryPath,
        sessionId: 'pi-fixture',
        ifNoneMatch: null,
      }),
    ).toMatchObject({ status: 'error', code: 'binaryMissing' });
  });
});
