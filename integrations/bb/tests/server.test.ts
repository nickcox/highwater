import { afterEach, describe, expect, it, vi } from 'vitest';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  createFakePluginHost,
  makeThreadResponse,
  type CreateFakePluginHostOptions,
  type FakePluginHost,
  type ExperimentalFakeHostRpcCall,
} from '@get-bb/plugin-sdk/testing';
import type { BbPluginApi } from '@get-bb/plugin-sdk';
import plugin from '../server';
import { analysis, deferred } from './helpers';
import { summariseAnalysis } from '../host/summary';

const threadId = 'thr_test1';
const transferId = '11111111-1111-4111-8111-111111111111';
const nextTransferId = '22222222-2222-4222-8222-222222222222';
const payload = analysis();
const bytes = gzipSync(JSON.stringify(payload));
const summary = summariseAnalysis(payload);
type Event = Awaited<ReturnType<BbPluginApi['sdk']['threads']['events']['list']>>[number];
const baseEvent = (seq: number) => ({
  id: `event-${seq}`,
  threadId,
  seq,
  createdAt: 1,
  scope: { kind: 'thread' as const },
});
const identity = (seq = 10, providerThreadId = 'native-session'): Event => ({
  ...baseEvent(seq),
  type: 'thread/identity',
  data: { providerThreadId },
});
const operation = (seq: number, operation = 'context_clear', status = 'completed'): Event => ({
  ...baseEvent(seq),
  type: 'system/operation',
  data: { operation, status, operationId: 'op-1', message: '' },
});
const opened = (firstPiece = bytes.toString('base64'), pieceCount = 1, id = transferId) => ({
  status: 'ok',
  etag: '"v1"',
  transferId: id,
  pieceCount,
  firstPiece,
});
const missing = () => Object.assign(new Error('not found'), { status: 404 });
const hosts: FakePluginHost[] = [];
afterEach(async () => {
  for (const host of hosts.splice(0)) await host.harness.lifecycle.dispose();
});
function setup(options: CreateFakePluginHostOptions = {}) {
  const defaults: CreateFakePluginHostOptions = {
    pluginId: 'highwater',
    sdk: {
      threads: {
        get: async () =>
          makeThreadResponse({ id: threadId, providerId: 'pi', environmentId: 'env_test' }),
        events: { list: async () => [identity()] },
        context: async () => ({
          usage: { usedTokens: 0, modelContextWindow: 200_000, estimated: false },
        }),
      },
      environments: { get: async () => ({ id: 'env_test', hostId: 'host_test' }) },
    },
    experimental_callHostRpc: async ({ method }) => {
      switch (method) {
        case 'status':
          return { state: 'ready', version: '0.5.1' };
        case 'findSession':
          return { found: true, sessionId: 'pi-catalogue-reference' };
        case 'openAnalysis':
          return opened();
        case 'readAnalysisPiece':
          return { piece: bytes.toString('base64') };
        case 'closeAnalysisTransfer':
          return { closed: true };
        case 'summary':
          return { status: 'ok', etag: '"v1"', summary };
        default:
          throw new Error(`Unexpected method ${method}`);
      }
    },
  };
  const driver = vi.fn(options.experimental_callHostRpc ?? defaults.experimental_callHostRpc!);
  const host = createFakePluginHost({ ...defaults, ...options, experimental_callHostRpc: driver });
  hosts.push(host);
  plugin(host.bb);
  const rpc = (ifNoneMatch: string | null = null) =>
    host.harness.behavior.callRpc('threadSummary', { threadId, ifNoneMatch });
  const http = (init?: RequestInit) =>
    host.harness.behavior.fetchHttp('GET', `/analysis?threadId=${threadId}`, init);
  return { ...host, driver, http, rpc };
}

// Run each resolution state through both boundaries, not only through the resolver.
describe('thread resolution states', () => {
  const cases: [string, (host: ReturnType<typeof setup>) => void, object][] = [
    [
      'unknownThread',
      ({ harness }) =>
        harness.sdk.stub('threads.get', async () => {
          throw missing();
        }),
      { state: 'unknownThread' },
    ],
    [
      'unsupportedAgent',
      ({ harness }) =>
        harness.sdk.stub('threads.get', async () => makeThreadResponse({ providerId: 'opencode' })),
      { state: 'unsupportedAgent', providerId: 'opencode' },
    ],
    [
      'noEnvironment',
      ({ harness }) =>
        harness.sdk.stub('threads.get', async () =>
          makeThreadResponse({ providerId: 'pi', environmentId: null }),
        ),
      { state: 'noEnvironment' },
    ],
    [
      'missing environment',
      ({ harness }) =>
        harness.sdk.stub('environments.get', async () => {
          throw missing();
        }),
      { state: 'noEnvironment' },
    ],
    [
      'noSession',
      ({ harness }) => harness.sdk.stub('threads.events.list', async () => []),
      { state: 'noSession' },
    ],
    [
      'clear before identity',
      ({ harness }) =>
        harness.sdk.stub('threads.events.list', async () => [operation(20), identity()]),
      { state: 'noSession' },
    ],
    [
      'binaryMissing',
      ({ driver }) => driver.mockImplementation(async () => ({ state: 'missing' })),
      { state: 'binaryMissing' },
    ],
    [
      'unsupportedVersion',
      ({ driver }) =>
        driver.mockImplementation(async () => ({
          state: 'unsupportedVersion',
          version: '9.0.0',
          accepted: '>=0.5.0 <0.6.0',
        })),
      { state: 'unsupportedVersion', version: '9.0.0', accepted: '>=0.5.0 <0.6.0' },
    ],
    [
      'startFailed',
      ({ driver }) =>
        driver.mockImplementation(async () => ({ state: 'failed', message: 'could not start' })),
      { state: 'startFailed', message: 'could not start' },
    ],
    [
      'sessionNotFound',
      ({ driver }) => {
        const original = driver.getMockImplementation()!;
        driver.mockImplementation((call) =>
          call.method === 'findSession' ? { found: false } : original(call),
        );
      },
      { state: 'sessionNotFound', providerThreadId: 'native-session' },
    ],
  ];
  it.each(cases)('%s', async (_name, configure, expected) => {
    const host = setup();
    configure(host);
    expect(await host.rpc()).toEqual(expected);
    const response = await host.http();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expected);
    expect(
      host.driver.mock.calls.some(([call]) => ['summary', 'openAnalysis'].includes(call.method)),
    ).toBe(false);
  });
  it('preserves catalogue failures instead of reporting sessionNotFound', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) =>
      call.method === 'findSession'
        ? { status: 'error', httpStatus: 503, code: 'catalogueUnavailable', message: 'try later' }
        : original(call),
    );
    expect(await host.rpc()).toEqual({
      state: 'error',
      httpStatus: 503,
      code: 'catalogueUnavailable',
      message: 'try later',
    });
    const response = await host.http();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: 'catalogueUnavailable', message: 'try later' },
    });
  });
  it('does not turn SDK or host transport failures into unknownThread', async () => {
    const host = setup();
    host.harness.sdk.stub('threads.get', async () => {
      throw Object.assign(new Error('unavailable'), { status: 503 });
    });
    expect(await host.rpc()).toMatchObject({
      state: 'error',
      httpStatus: 502,
      code: 'bbUnavailable',
    });
    expect((await host.http()).status).toBe(502);
    host.harness.sdk.stub('threads.get', async () =>
      makeThreadResponse({ providerId: 'pi', environmentId: 'env_test' }),
    );
    host.driver.mockRejectedValue(new Error('daemon offline'));
    expect(await host.rpc()).toMatchObject({ state: 'error', code: 'bbUnavailable' });
  });
});

describe('identity history', () => {
  it('pages backward past unrelated and incomplete operations using exclusive sequence cursors', async () => {
    const host = setup();
    host.harness.sdk.stub('threads.events.list', async (args: { beforeSeq?: string }) =>
      args.beforeSeq
        ? [
            operation(19, 'context_clear', 'failed'),
            identity(18, 'new-session'),
            identity(17, 'old-session'),
          ]
        : [operation(22, 'compact'), operation(21, 'context_clear', 'started')],
    );
    expect(await host.rpc()).toMatchObject({ state: 'ok' });
    expect(host.harness.sdk.callsTo('threads.events.list').map(([input]) => input)).toMatchObject([
      { order: 'desc', types: ['thread/identity', 'system/operation'], limit: '100' },
      { order: 'desc', beforeSeq: '21' },
    ]);
    expect(
      host.driver.mock.calls.find(([call]) => call.method === 'findSession')?.[0].input,
    ).toMatchObject({ providerThreadId: 'new-session' });
  });
  it('finds a completed clear on a later page and never reads an older identity', async () => {
    const host = setup();
    host.harness.sdk.stub('threads.events.list', async (args: { beforeSeq?: string }) =>
      args.beforeSeq ? [operation(9), identity(8)] : [operation(10, 'compact')],
    );
    expect(await host.rpc()).toEqual({ state: 'noSession' });
    expect(host.driver).not.toHaveBeenCalled();
  });
  it('exhausts histories with only unrelated operations', async () => {
    const host = setup();
    host.harness.sdk.stub('threads.events.list', async (args: { beforeSeq?: string }) =>
      args.beforeSeq ? [] : [operation(10, 'compact')],
    );
    expect(await host.rpc()).toEqual({ state: 'noSession' });
  });
  it('rejects a non-advancing event page instead of looping forever', async () => {
    const host = setup();
    host.harness.sdk.stub('threads.events.list', async () => [operation(10, 'compact')]);
    expect(await host.rpc()).toMatchObject({ state: 'error', code: 'bbUnavailable' });
    expect(host.harness.sdk.callsTo('threads.events.list')).toHaveLength(2);
  });
  it.each(['', 'x'.repeat(257)])(
    'does not fall back past an unusable newest identity',
    async (id) => {
      const host = setup();
      host.harness.sdk.stub('threads.events.list', async () => [identity(20, id), identity(10)]);
      expect(await host.rpc()).toEqual({ state: 'noSession' });
      expect(host.driver).not.toHaveBeenCalled();
    },
  );
  it('resolves again after edits, clears and new or duplicate identities, including Claude Code', async () => {
    const host = setup();
    host.harness.sdk.stub('threads.get', async () =>
      makeThreadResponse({ providerId: 'claude-code', environmentId: 'env_test' }),
    );
    let events = [identity(20, 'new-session'), operation(19), identity(18, 'old-session')];
    host.harness.sdk.stub('threads.events.list', async () => events);
    await host.rpc();
    events = [identity(21, 'new-session'), ...events];
    await host.http();
    events = [identity(30, 'edited-session')];
    await host.rpc();
    expect(
      host.driver.mock.calls
        .filter(([call]) => call.method === 'findSession')
        .map(([call]) => call.input),
    ).toEqual([
      { binaryPath: null, harness: 'claude-code', providerThreadId: 'new-session' },
      { binaryPath: null, harness: 'claude-code', providerThreadId: 'new-session' },
      { binaryPath: null, harness: 'claude-code', providerThreadId: 'edited-session' },
    ]);
  });
});

describe('analysis HTTP route', () => {
  it.each([
    '',
    '?threadId=../file',
    '?threadId=thr_a_b',
    '?threadId=thr_',
    '?threadId=thr_a&sessionId=pi-other',
    '?threadId=thr_a&threadId=thr_b',
  ])('rejects invalid input %s before host access', async (query) => {
    const host = setup();
    const response = await host.harness.behavior.fetchHttp('GET', `/analysis${query}`);
    expect(response.status).toBe(400);
    expect(host.harness.sdk.calls).toHaveLength(0);
    expect(host.driver).not.toHaveBeenCalled();
  });
  it('rejects an oversized conditional header', async () => {
    const host = setup();
    expect((await host.http({ headers: { 'if-none-match': 'x'.repeat(1025) } })).status).toBe(400);
    expect(host.driver).not.toHaveBeenCalled();
  });
  it('returns gzip JSON with an ETag, disables storage, and closes even a single-piece transfer', async () => {
    const host = setup();
    const response = await host.http();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('etag')).toBe('"v1"');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString())).toEqual(
      payload,
    );
    expect(host.driver.mock.calls.at(-1)?.[0]).toMatchObject({
      method: 'closeAnalysisTransfer',
      input: { transferId },
      hostId: 'host_test',
    });
    expect(host.harness.registrations.httpRoutes).toMatchObject([
      { method: 'GET', path: '/analysis', auth: 'local' },
    ]);
  });
  it('passes If-None-Match unchanged and returns a bodyless 304 without opening a transfer', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) =>
      call.method === 'openAnalysis' ? { status: 'notModified', etag: '"v1"' } : original(call),
    );
    const conditional = 'W/"v1", "other"';
    const response = await host.http({ headers: { 'if-none-match': conditional } });
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    expect(response.headers.get('etag')).toBe('"v1"');
    expect(
      host.driver.mock.calls.find(([call]) => call.method === 'openAnalysis')?.[0].input,
    ).toMatchObject({ ifNoneMatch: conditional, sessionId: 'pi-catalogue-reference' });
    expect(host.driver.mock.calls.some(([call]) => call.method === 'closeAnalysisTransfer')).toBe(
      false,
    );
  });
  it('joins pieces in sequence, then releases their snapshot', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    const pieces = [bytes.subarray(0, 7), bytes.subarray(7, 19), bytes.subarray(19)];
    host.driver.mockImplementation((call) =>
      call.method === 'openAnalysis'
        ? opened(pieces[0].toString('base64'), 3)
        : call.method === 'readAnalysisPiece'
          ? { piece: pieces[(call.input as { index: number }).index].toString('base64') }
          : original(call),
    );
    expect(Buffer.from(await (await host.http()).arrayBuffer())).toEqual(bytes);
    expect(
      host.driver.mock.calls
        .filter(([call]) => call.method === 'readAnalysisPiece')
        .map(([call]) => call.input),
    ).toEqual([
      { transferId, index: 1 },
      { transferId, index: 2 },
    ]);
  });
  it.each([false, true])(
    'retries an expired transfer once, with repeated expiry=%s',
    async (repeat) => {
      const host = setup();
      const original = host.driver.getMockImplementation()!;
      let count = 0;
      host.driver.mockImplementation((call) => {
        if (call.method === 'openAnalysis')
          return ++count === 1 || repeat
            ? opened(
                bytes.subarray(0, 5).toString('base64'),
                2,
                count === 1 ? transferId : nextTransferId,
              )
            : opened(bytes.toString('base64'), 1, nextTransferId);
        if (call.method === 'readAnalysisPiece') return { expired: true };
        return original(call);
      });
      const response = await host.http();
      expect(response.status).toBe(repeat ? 503 : 200);
      if (!repeat) expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      else expect(await response.json()).toMatchObject({ error: { code: 'transferExpired' } });
      expect(count).toBe(2);
      expect(
        host.driver.mock.calls
          .filter(([call]) => call.method === 'closeAnalysisTransfer')
          .map(([call]) => call.input),
      ).toEqual([{ transferId }, { transferId: nextTransferId }]);
    },
  );
  it.each([
    opened('', 1),
    opened('not base64', 1),
    opened(bytes.toString('base64'), 17),
    opened(Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64'), 1),
  ])('bounds and validates the transfer before responding', async (result) => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) =>
      call.method === 'openAnalysis' ? result : original(call),
    );
    const response = await host.http();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: 'transferInvalid' } });
    expect(host.driver.mock.calls.filter(([call]) => call.method === 'openAnalysis')).toHaveLength(
      1,
    );
    expect(
      host.driver.mock.calls.filter(([call]) => call.method === 'closeAnalysisTransfer'),
    ).toHaveLength(1);
  });
  it('preserves Highwater analysis errors and does not retry them', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) =>
      call.method === 'openAnalysis' || call.method === 'summary'
        ? {
            status: 'error',
            httpStatus: 422,
            code: 'SESSION_PARSE_FAILED',
            message: 'source session is invalid',
          }
        : original(call),
    );
    const response = await host.http();
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: 'SESSION_PARSE_FAILED', message: 'source session is invalid' },
    });
    expect(await host.rpc()).toEqual({
      state: 'error',
      httpStatus: 422,
      code: 'SESSION_PARSE_FAILED',
      message: 'source session is invalid',
    });
    expect(host.driver.mock.calls.filter(([call]) => call.method === 'openAnalysis')).toHaveLength(
      1,
    );
  });
  it('releases the transfer after a piece call fails', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) =>
      call.method === 'openAnalysis'
        ? opened(bytes.subarray(0, 5).toString('base64'), 2)
        : call.method === 'readAnalysisPiece'
          ? Promise.reject(new Error('worker exited'))
          : original(call),
    );
    expect((await host.http()).status).toBe(502);
    expect(host.driver.mock.calls.at(-1)?.[0].method).toBe('closeAnalysisTransfer');
  });
  it('does not replace a valid response when closing fails', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) =>
      call.method === 'closeAnalysisTransfer'
        ? Promise.reject(new Error('worker exited'))
        : original(call),
    );
    expect((await host.http()).status).toBe(200);
    expect(host.harness.logEntries).toMatchObject([{ level: 'warn' }]);
  });
  it('cancels a piece read and closes using a separate, live signal', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    const reading = deferred<ExperimentalFakeHostRpcCall>();
    host.driver.mockImplementation((call) => {
      if (call.method === 'openAnalysis') return opened(bytes.subarray(0, 5).toString('base64'), 2);
      if (call.method === 'readAnalysisPiece') {
        reading.resolve(call);
        return new Promise((_resolve, reject) =>
          call.signal!.addEventListener('abort', () => reject(call.signal!.reason), { once: true }),
        );
      }
      return original(call);
    });
    const controller = new AbortController();
    const response = host.http({ signal: controller.signal });
    const read = await reading.promise;
    controller.abort();
    expect((await response).status).toBe(499);
    expect(host.harness.logEntries).toHaveLength(0);
    expect(read.signal?.aborted).toBe(true);
    const close = host.driver.mock.calls.find(
      ([call]) => call.method === 'closeAnalysisTransfer',
    )?.[0];
    expect(close?.signal?.aborted).toBe(false);
  });
});

describe('summary, settings and signals', () => {
  it('aborts an active HTTP handler when the plugin generation is disposed', async () => {
    const host = setup();
    const reading = deferred<ExperimentalFakeHostRpcCall>();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) => {
      if (call.method === 'openAnalysis') return opened(bytes.subarray(0, 5).toString('base64'), 2);
      if (call.method === 'readAnalysisPiece') {
        reading.resolve(call);
        return new Promise((_resolve, reject) =>
          call.signal!.addEventListener('abort', () => reject(call.signal!.reason), { once: true }),
        );
      }
      return original(call);
    });
    const pending = host.http();
    const read = await reading.promise;
    await host.harness.lifecycle.dispose();
    expect(read.signal?.aborted).toBe(true);
    expect((await pending).status).toBe(499);
  });
  it('cancels summary work without reading context usage afterwards', async () => {
    const host = setup();
    const reading = deferred<ExperimentalFakeHostRpcCall>();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) => {
      if (call.method === 'summary') {
        reading.resolve(call);
        return new Promise((_resolve, reject) =>
          call.signal!.addEventListener('abort', () => reject(call.signal!.reason), { once: true }),
        );
      }
      return original(call);
    });
    const controller = new AbortController();
    const pending = host.harness.behavior.callRpc(
      'threadSummary',
      { threadId, ifNoneMatch: null },
      { signal: controller.signal },
    );
    const read = await reading.promise;
    controller.abort();
    expect(await pending).toMatchObject({
      state: 'error',
      httpStatus: 499,
      code: 'requestCancelled',
    });
    expect(host.harness.logEntries).toHaveLength(0);
    expect(read.signal?.aborted).toBe(true);
    expect(host.harness.sdk.callsTo('threads.context')).toHaveLength(0);
  });
  it('bounds the binary setting before it can reach the host', async () => {
    const host = setup();
    await expect(
      host.harness.behavior.setSettings({ binaryPath: 'x'.repeat(4097) }),
    ).rejects.toThrow();
    expect(host.driver).not.toHaveBeenCalled();
  });
  it('returns a small summary and current usage, including zero, without an analysis transfer', async () => {
    const host = setup();
    expect(await host.rpc()).toEqual({
      state: 'ok',
      etag: '"v1"',
      summary,
      usage: { usedTokens: 0, contextWindowTokens: 200_000 },
    });
    expect(
      host.driver.mock.calls.some(([call]) =>
        ['openAnalysis', 'readAnalysisPiece'].includes(call.method),
      ),
    ).toBe(false);
  });
  it('reads usage afresh even when the analysis is unchanged, and supports missing usage', async () => {
    const host = setup();
    const original = host.driver.getMockImplementation()!;
    host.driver.mockImplementation((call) =>
      call.method === 'summary' ? { status: 'notModified', etag: '"v1"' } : original(call),
    );
    expect(await host.rpc('"v1"')).toEqual({
      state: 'notModified',
      etag: '"v1"',
      usage: { usedTokens: 0, contextWindowTokens: 200_000 },
    });
    host.harness.sdk.stub('threads.context', async () => ({ usage: null }));
    expect(await host.rpc('"v1"')).toEqual({ state: 'notModified', etag: '"v1"', usage: null });
  });
  it('rejects untrusted RPC fields and malformed IDs at the SDK boundary', async () => {
    const host = setup();
    await expect(
      host.harness.behavior.callRpc('threadSummary', { threadId: '../file', ifNoneMatch: null }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      host.harness.behavior.callRpc('threadSummary', {
        threadId,
        ifNoneMatch: null,
        sessionId: 'pi-other',
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(host.driver).not.toHaveBeenCalled();
  });
  it('uses the resolved host and re-reads the binary override on each request', async () => {
    const host = setup({ settings: { binaryPath: ' /first/highwater ' } });
    await host.rpc();
    await host.harness.behavior.setSettings({ binaryPath: '/second/highwater' });
    await host.http();
    expect(
      host.driver.mock.calls
        .filter(([call]) => call.method === 'status')
        .map(([call]) => call.input),
    ).toEqual([{ binaryPath: '/first/highwater' }, { binaryPath: '/second/highwater' }]);
    expect(host.driver.mock.calls.every(([call]) => call.hostId === 'host_test')).toBe(true);
  });
  it('publishes thread-advanced for coalesced events, idle and failure only', async () => {
    const host = setup();
    const thread = makeThreadResponse({ id: threadId });
    await host.harness.behavior.emitThreadEvent('experimental_thread.events', {
      thread,
      sequence: 10,
    });
    await host.harness.behavior.emitThreadEvent('thread.idle', {
      thread,
      lastAssistantText: 'done',
    });
    await host.harness.behavior.emitThreadEvent('thread.failed', { thread, error: 'failed' });
    expect(host.harness.realtimeSignals).toMatchObject([
      { channel: 'thread-advanced', payload: { threadId, idle: false } },
      { channel: 'thread-advanced', payload: { threadId, idle: true } },
      { channel: 'thread-advanced', payload: { threadId, idle: true } },
    ]);
    expect(host.driver).not.toHaveBeenCalled();
    expect(host.harness.registrations.services).toHaveLength(0);
    expect(host.harness.registrations.schedules).toHaveLength(0);
  });
});
