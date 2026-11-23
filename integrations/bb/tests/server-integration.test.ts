import { describe, expect, it } from 'vitest';
import { basename, join } from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createFakePluginHost, makeThreadResponse } from '@get-bb/plugin-sdk/testing';
import { experimental_createHostEntryHarness } from '@get-bb/plugin-sdk/testing/host';
import { hostContract } from '../contract';
import { createHighwaterEntry } from '../host';
import plugin from '../server';
import { binaries, claudeFixtures, codexFixtures, tempDirectory, writePi } from './helpers';

for (const binaryPath of binaries) {
  describe(`server and real host: ${binaryPath}`, () => {
    it.each(['pi', 'legacy Pi', 'claude-code', 'codex'])(
      'serves a %s analysis and summary through the complete contracts',
      async (source) => {
        const providerId = source === 'legacy Pi' ? 'pi' : source;
        const home = await tempDirectory();
        const plugins = join(home, '.bb/plugins');
        const host = experimental_createHostEntryHarness(
          createHighwaterEntry({
            process: { home, env: { PATH: process.env.PATH } },
            analysis: { pieceBytes: 1024 },
          }),
          {
            experimental_paths: {
              dataDir: join(plugins, 'highwater/host-data'),
              tempDir: join(home, 'tmp'),
            },
          },
        );
        const threadId = 'thr_integration1';
        const server = createFakePluginHost({
          pluginId: 'highwater',
          settings: { binaryPath },
          sdk: {
            threads: {
              get: async () =>
                makeThreadResponse({ id: threadId, providerId, environmentId: 'env_test' }),
              events: {
                list: async () => [
                  {
                    id: 'event-1',
                    threadId,
                    seq: 1,
                    createdAt: 1,
                    scope: { kind: 'thread' },
                    type: 'thread/identity',
                    data: {
                      providerThreadId:
                        providerId === 'pi'
                          ? 'probe-main'
                          : providerId === 'claude-code'
                            ? 'simple'
                            : '01a10000-0000-7000-8000-000000000001',
                    },
                  },
                ],
              },
              context: async () => ({ usage: null }),
            },
            environments: { get: async () => ({ id: 'env_test', hostId: 'host_test' }) },
          },
          experimental_callHostRpc: (call) => {
            const method = call.method as keyof typeof hostContract;
            return host.experimental_call(method, hostContract[method].input.parse(call.input), {
              signal: call.signal,
            });
          },
        });
        try {
          const piFile = await writePi(home);
          const records = (await readFile(piFile, 'utf8'))
            .trimEnd()
            .split('\n')
            .map((line) => JSON.parse(line));
          // bb's Pi filename identity need not equal the native session header ID.
          records[0].id = 'native-pi-session';
          const longMessage = 'x'.repeat(8191) + '🌊tail';
          records[1].message.content[0].text = longMessage;
          await writeFile(
            piFile,
            records.map((record) => JSON.stringify(record)).join('\n') + '\n',
          );
          if (providerId === 'pi') {
            const sessions = join(plugins, 'provider-pi/bridge-data/sessions');
            await mkdir(sessions, { recursive: true });
            if (source === 'pi') {
              await rename(piFile, join(sessions, basename(piFile)));
              await writePi(home);
            }
          }
          await claudeFixtures(home);
          await codexFixtures(home);
          plugin(server.bb);
          const response = await server.harness.behavior.fetchHttp(
            'GET',
            `/analysis?threadId=${threadId}`,
          );
          expect(response.status).toBe(200);
          const analysis = JSON.parse(
            gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8'),
          );
          expect(analysis.schemaVersion).toBe(1);
          if (providerId === 'pi') expect(analysis.session.id).toBe('native-pi-session');
          expect(analysis.modelCalls.length).toBeGreaterThan(0);
          const userItem = analysis.contextItems.find(
            (item: { kind: string }) => item.kind === 'userMessage',
          );
          expect(userItem.preview).not.toHaveProperty('expandedText');
          const query = new URLSearchParams({
            threadId,
            nativeSessionId: analysis.session.id,
            itemId: userItem.id,
          });
          const first = await server.harness.behavior.fetchHttp('GET', `/item-content?${query}`);
          expect(first.status).toBe(200);
          expect(first.headers.get('cache-control')).toBe('private, no-store');
          const page = await first.json();
          expect(page.text).toBeTruthy();
          if (providerId === 'pi') {
            expect(page.text).toBe('x'.repeat(8191));
            query.set('cursor', page.nextCursor);
            const next = await server.harness.behavior.fetchHttp('GET', `/item-content?${query}`);
            expect(await next.json()).toEqual({ text: '🌊tail', nextCursor: null });
            query.delete('cursor');
            query.set('nativeSessionId', 'stale-session');
            const stale = await server.harness.behavior.fetchHttp('GET', `/item-content?${query}`);
            expect(stale.status).toBe(409);
          }
          const etag = response.headers.get('etag');
          expect(etag).toBeTruthy();
          const unchanged = await server.harness.behavior.fetchHttp(
            'GET',
            `/analysis?threadId=${threadId}`,
            { headers: { 'if-none-match': etag! } },
          );
          expect(unchanged.status).toBe(304);
          expect(await unchanged.text()).toBe('');
          const summary = await server.harness.behavior.callRpc('threadSummary', {
            threadId,
            ifNoneMatch: null,
          });
          expect(summary).toMatchObject({
            state: 'ok',
            etag,
            summary: { callCount: analysis.modelCalls.length },
            usage: null,
          });
          if (providerId === 'pi')
            expect(summary).toMatchObject({
              summary: {
                latestComposition: {
                  segments: expect.arrayContaining([
                    { kind: 'userMessage', tokens: expect.any(Number) },
                  ]),
                },
              },
            });
          expect(
            await server.harness.behavior.callRpc('threadSummary', { threadId, ifNoneMatch: etag }),
          ).toEqual({ state: 'notModified', etag, usage: null });
        } finally {
          await server.harness.lifecycle.dispose();
          await host.experimental_dispose();
          await rm(home, { recursive: true, force: true });
        }
      },
    );
  });
}
