// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, waitFor, fireEvent } from '@testing-library/react';
import { loadPluginApp, renderSlot } from '@get-bb/plugin-sdk/testing/app';
import app from '../app';
import { repository, deferred, wholeText } from './helpers';
import type { ThreadState } from '../state';
import pinned from '../host/binary-release.json';
import type {
  ExperimentalThreadActionTabProps,
  ExperimentalTabRegistration,
} from '@get-bb/plugin-sdk';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const fixture = JSON.parse(
  readFileSync(join(repository, 'fixtures/analysis/system-context.json'), 'utf8'),
);
const slots: ReturnType<typeof renderSlot>[] = [];
let serial = 0;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  const entries = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  });
});
afterEach(async () => {
  for (const slot of slots.splice(0)) slot.lifecycle.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  vi.unstubAllGlobals();
});
async function mount(
  options: { threadId?: string; visible?: boolean; mode?: 'light' | 'dark' } = {},
) {
  const captured = await loadPluginApp(app);
  expect(captured.tabs).toHaveLength(1);
  const tab = captured.tabs[0] as Extract<
    ExperimentalTabRegistration,
    { context: { kind: 'thread' }; availability: 'action' }
  >;
  expect(tab).toMatchObject({
    id: 'context',
    context: { kind: 'thread' },
    availability: 'action',
    layout: 'flush',
  });
  const slot = renderSlot<ExperimentalThreadActionTabProps>(
    tab,
    { threadId: options.threadId ?? `thr_ui${++serial}`, environment: null, params: null },
    {
      pluginId: 'highwater-test',
      tabVisible: options.visible ?? true,
      codeTheme: { mode: options.mode ?? 'dark' },
      realtimeConnectionState: 'connected',
    },
  );
  slots.push(slot);
  return slot;
}
function target(slot: ReturnType<typeof renderSlot>) {
  return slot.container.querySelector('[data-highwater-thread] > div') as HTMLDivElement;
}
async function ready(slot: ReturnType<typeof renderSlot>) {
  await waitFor(() => expect(target(slot).shadowRoot?.textContent).toContain('Context River'));
}

describe('Context tab', () => {
  it.each(['light', 'dark'] as const)(
    'mounts the real embedded view in the %s palette without changing bb’s document',
    async (mode) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(fixture, { headers: { etag: '"v1"' } }));
      vi.stubGlobal('fetch', fetcher);
      const previousTheme = document.documentElement.getAttribute('data-theme');
      const slot = await mount({ mode });
      await ready(slot);
      expect(target(slot).dataset.theme).toBe(mode);
      expect(document.documentElement.getAttribute('data-theme')).toBe(previousTheme);
      expect(target(slot).shadowRoot?.querySelector('style')).not.toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem('highwater.theme.v1')).toBeNull();
      expect(slot.inspection.rpcCalls).toHaveLength(0);
    },
  );
  it('shows the latest call before the chart', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(fixture, { headers: { etag: '"v1"' } })),
    );
    const slot = await mount();
    await ready(slot);
    const root = target(slot).shadowRoot!;
    await waitFor(() =>
      expect(root.getElementById('call-overview-heading')?.textContent).toContain('Latest call'),
    );
    const sections = [...root.querySelectorAll('.exploration-grid > *')].map(
      (node) => node.className.split(' ')[0],
    );
    expect(sections.indexOf('call-section')).toBeLessThan(sections.indexOf('panel'));
  });
  it('says when an explicit binary is a different version from the pin', async () => {
    let version = '9.9.9';
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () =>
          Response.json(fixture, { headers: { etag: '"v1"', 'x-highwater-version': version } }),
        ),
    );
    const slot = await mount();
    await ready(slot);
    expect(slot.getByRole('note').textContent).toBe(
      `Using Highwater 9.9.9 from the Highwater binary setting. This plugin was built for ${pinned.version}, so some views may not work.`,
    );
    version = pinned.version;
    const matching = await mount();
    await ready(matching);
    expect(matching.container.querySelector('[role="note"]')).toBeNull();
  });
  it('shares a single analysis request between two views of the same thread', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(fixture, { headers: { etag: '"v1"' } }));
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_ui${++serial}`;
    const a = await mount({ threadId });
    const b = await mount({ threadId });
    await ready(a);
    await ready(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps two different threads and their embedded roots independent in one window', async () => {
    const firstId = `thr_ui${++serial}`;
    const secondId = `thr_ui${++serial}`;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const id = new URL(String(input), 'http://plugin.test').searchParams.get('threadId');
      const analysis = structuredClone(fixture);
      analysis.session.workingDirectory = `/tmp/${id}`;
      return Response.json(analysis, { headers: { etag: `"${id}"` } });
    });
    vi.stubGlobal('fetch', fetcher);
    const a = await mount({ threadId: firstId });
    const b = await mount({ threadId: secondId });
    await ready(a);
    await ready(b);
    expect(target(a).shadowRoot?.textContent).toContain(`/tmp/${firstId}`);
    expect(target(a).shadowRoot?.textContent).not.toContain(`/tmp/${secondId}`);
    expect(target(b).shadowRoot?.textContent).toContain(`/tmp/${secondId}`);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('shares row/tab refreshes and stops transferring analyses when only the row remains', async () => {
    const threadId = `thr_ui${++serial}`;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) =>
      String(input).includes('/rpc/')
        ? Response.json({
            ok: true,
            result: {
              state: 'ok',
              etag: '"v1"',
              summary: {
                callCount: 3,
                compactionCount: 1,
                latestInputTokens: 560,
                peakInputTokens: 600,
                series: [600, 550, 560],
                compactionPoints: [],
                recentGrowth: null,
              },
              usage: { usedTokens: 62400, contextWindowTokens: 200000 },
            },
          })
        : Response.json(fixture, { headers: { etag: '"v1"' } }),
    );
    vi.stubGlobal('fetch', fetcher);
    const captured = await loadPluginApp(app);
    const row = renderSlot(
      captured.threadContextCardRows[0],
      { threadId, projectId: 'proj_test', environment: null },
      { pluginId: 'highwater-test' },
    );
    slots.push(row);
    const tab = await mount({ threadId });
    await ready(tab);
    expect(await row.findByText(wholeText('3 calls · 1 compaction'))).toBeTruthy();
    expect(target(tab).shadowRoot?.textContent).toMatch(/Model calls3/);
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes('/http/analysis')),
    ).toHaveLength(1);
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes('/rpc/threadSummary')),
    ).toHaveLength(1);
    tab.lifecycle.unmount();
    await row.behavior.emitRealtime('thread-advanced', { threadId, idle: false });
    await waitFor(
      () =>
        expect(
          fetcher.mock.calls.filter(([url]) => String(url).includes('/rpc/threadSummary')),
        ).toHaveLength(2),
      { timeout: 4000 },
    );
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes('/http/analysis')),
    ).toHaveLength(1);
  });
  it('does no work for a hidden tab', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const slot = await mount({ visible: false });
    await slot.behavior.emitRealtime('thread-advanced', { threadId: 'thr_other', idle: false });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetcher).not.toHaveBeenCalled();
  });
  const cases: [ThreadState, string][] = [
    [{ state: 'unknownThread' }, 'Thread not found'],
    [{ state: 'unsupportedAgent', providerId: 'opencode' }, 'Agent not supported'],
    [{ state: 'noEnvironment' }, 'No machine assigned'],
    [{ state: 'noSession' }, 'No session yet'],
    [{ state: 'binaryMissing' }, 'Highwater binary not found'],
    [{ state: 'startFailed', message: 'Failed to launch' }, 'Highwater could not start'],
    [{ state: 'sessionNotFound', providerThreadId: 'native-session' }, 'Session file not found'],
    [
      {
        state: 'error',
        httpStatus: 422,
        code: 'SESSION_PARSE_FAILED',
        message: 'source session is invalid',
      },
      'Analysis could not be updated',
    ],
  ];
  it.each(cases)('shows a clear message and Retry for %s', async (state, title) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () =>
          state.state === 'error'
            ? Response.json(
                { error: { code: state.code, message: state.message } },
                { status: state.httpStatus },
              )
            : Response.json(state, { status: 409 }),
        ),
    );
    const slot = await mount();
    expect(await slot.findByText(title)).toBeTruthy();
    expect(slot.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(target(slot).shadowRoot).toBeNull();
  });
  it('refreshes on this thread’s events and reconnect, without replacing the mounted view on a 304', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        fetcher.mock.calls.length === 1
          ? Response.json(fixture, { headers: { etag: '"v1"' } })
          : new Response(null, { status: 304, headers: { etag: '"v1"' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_ui${++serial}`;
    const slot = await mount({ threadId });
    await ready(slot);
    const root = target(slot).shadowRoot;
    await slot.behavior.emitRealtime('thread-advanced', { threadId: 'thr_other', idle: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await slot.behavior.emitRealtime('thread-advanced', { threadId, idle: false });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ 'If-None-Match': '"v1"' });
    expect(target(slot).shadowRoot).toBe(root);
    await slot.behavior.setRealtimeConnectionState('reconnecting');
    await slot.behavior.setRealtimeConnectionState('connected');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3), { timeout: 4000 });
  });
  it('shows Updating while a shared fetch is in flight, then returns to Live', async () => {
    const pending = deferred<Response>();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(fixture, { headers: { etag: '"v1"' } }))
      .mockImplementation(() => pending.promise);
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_ui${++serial}`;
    const slot = await mount({ threadId });
    await ready(slot);
    await slot.behavior.emitRealtime('thread-advanced', { threadId, idle: false });
    await waitFor(
      () =>
        expect(target(slot).shadowRoot?.querySelector('header [role="status"]')?.textContent).toBe(
          'Updating…',
        ),
      { timeout: 4000 },
    );
    pending.resolve(new Response(null, { status: 304 }));
    await waitFor(() =>
      expect(target(slot).shadowRoot?.querySelector('header [role="status"]')?.textContent).toBe(
        'Live',
      ),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    [413, 'analysisTooLarge', 'Highwater response exceeds the 134217728-byte limit.'],
    [504, 'analysisTimeout', 'Highwater did not respond before the request timed out.'],
  ] as const)(
    'shows the limit message and Retry for %s instead of mounting a broken chart',
    async (status, code, message) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ error: { code, message } }, { status })),
      );
      const slot = await mount();
      expect(await slot.findByText(message)).toBeTruthy();
      expect(slot.getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(target(slot).shadowRoot).toBeNull();
    },
  );
  it('uses Retry to recover from a missing binary', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ state: 'binaryMissing' }, { status: 409 }))
      .mockImplementation(async () => Response.json(fixture, { headers: { etag: '"v1"' } }));
    vi.stubGlobal('fetch', fetcher);
    const slot = await mount();
    await slot.findByText('Highwater binary not found');
    fireEvent.click(slot.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(target(slot).shadowRoot?.textContent).toContain('Context River'), {
      timeout: 4000,
    });
  });
  it('destroys the view on unmount and cancels future refreshes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(fixture, { headers: { etag: '"v1"' } }));
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_ui${++serial}`;
    const slot = await mount({ threadId });
    await ready(slot);
    const root = target(slot).shadowRoot!;
    await slot.behavior.emitRealtime('thread-advanced', { threadId, idle: true });
    slot.lifecycle.unmount();
    expect(root.childNodes.length).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
