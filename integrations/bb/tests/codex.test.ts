import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { experimental_createHostEntryHarness } from '@get-bb/plugin-sdk/testing/host';
import { createHighwaterEntry } from '../host';
import { matchSession } from '../host/catalogue';
import { binaries, codexFixtures, tempDirectory } from './helpers';

const id = '01a10000-0000-7000-8000-000000000001';
const entry = (fileName: string, extra = {}) => ({
  id: 'codex-main',
  harness: 'codex',
  fileName,
  parentReference: null,
  ...extra,
});
describe('Codex filename matching', () => {
  it.each(['.jsonl', '.jsonl.zst'])(
    'matches an entire UUID after the rollout timestamp, including %s',
    (extension) => {
      const name = `rollout-2026-10-01T10-00-00-${id}${extension}`;
      expect(matchSession([entry(name)], 'codex', id)).toBe('codex-main');
      expect(matchSession([entry(name)], 'codex', id.toUpperCase())).toBe('codex-main');
    },
  );
  it('rejects suffix fragments, unsafe identities, wrong extensions, prefixes and other harnesses', () => {
    const name = `rollout-2026-10-01T10-00-00-${id}.jsonl`;
    for (const native of ['000000000001', '../' + id, id + '-extra', ''])
      expect(matchSession([entry(name)], 'codex', native)).toBeNull();
    for (const file of [
      `notes-${id}.jsonl`,
      name + '.bak',
      name + '.zst.bak',
      name.replace(id, '01a10000-0000-7000-8000-000000000002'),
    ])
      expect(matchSession([entry(file)], 'codex', id)).toBeNull();
    expect(matchSession([entry(name, { harness: 'pi' })], 'codex', id)).toBeNull();
  });
  it('excludes subagents and selects the newest matching main file', () => {
    const name = `rollout-2026-10-01T10-00-00-${id}.jsonl`;
    expect(
      matchSession(
        [
          entry(name, {
            id: 'child',
            parentReference: 'codex-parent',
            modifiedAt: '2026-11-01T00:00:00Z',
          }),
          entry(name, { id: 'old', modifiedAt: '2026-10-01T10:00:00.000000001Z' }),
          entry(name + '.zst', { id: 'new', modifiedAt: '2026-10-01T10:00:00.000000002Z' }),
        ],
        'codex',
        id,
      ),
    ).toBe('new');
  });
});

for (const binaryPath of binaries) {
  it(`reads main, compressed, archived and forked Codex sessions through the real host: ${binaryPath}`, async () => {
    const home = await tempDirectory();
    const host = experimental_createHostEntryHarness(
      createHighwaterEntry({ process: { home, env: { PATH: process.env.PATH } } }),
      { experimental_paths: { dataDir: join(home, 'data'), tempDir: join(home, 'tmp') } },
    );
    try {
      await codexFixtures(home);
      for (const native of [
        id,
        '01a10000-0000-7000-8000-000000000002',
        '01a10000-0000-7000-8000-000000000006',
        '01a30000-0000-7000-8000-000000000008',
      ]) {
        const found = await host.experimental_call('findSession', {
          binaryPath,
          harness: 'codex',
          providerThreadId: native,
        });
        expect(found).toMatchObject({ found: true });
        if (!('found' in found) || !found.found) throw new Error('Codex fixture was not found');
        const input = { binaryPath, sessionId: found.sessionId, ifNoneMatch: null };
        const opened = await host.experimental_call('openAnalysis', input);
        expect(opened.status).toBe('ok');
        if (opened.status !== 'ok') throw new Error('Codex analysis was not opened');
        try {
          expect(opened.pieceCount).toBe(1);
          const data = JSON.parse(
            gunzipSync(Buffer.from(opened.firstPiece, 'base64')).toString('utf8'),
          );
          expect(data.schemaVersion).toBe(1);
          expect(data.session.source).toBe('codex');
          expect(data.session.id).toBe(native);
          expect(data.modelCalls.length).toBeGreaterThan(0);
          expect(await host.experimental_call('summary', input)).toMatchObject({
            status: 'ok',
            etag: opened.etag,
            summary: { callCount: data.modelCalls.length },
          });
          expect(
            await host.experimental_call('openAnalysis', { ...input, ifNoneMatch: opened.etag }),
          ).toEqual({ status: 'notModified', etag: opened.etag });
        } finally {
          await host.experimental_call('closeAnalysisTransfer', { transferId: opened.transferId });
        }
      }
      for (const suffix of ['003', '004', '099']) {
        expect(
          await host.experimental_call('findSession', {
            binaryPath,
            harness: 'codex',
            providerThreadId: `01a10000-0000-7000-8000-000000000${suffix}`,
          }),
        ).toEqual({ found: false });
      }
    } finally {
      await host.experimental_dispose();
      await rm(home, { recursive: true, force: true });
    }
  });
}
