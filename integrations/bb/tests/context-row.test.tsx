// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, waitFor } from '@testing-library/react';
import { loadPluginApp, renderSlot } from '@get-bb/plugin-sdk/testing/app';
import app from '../app';
import {
  ContextSegment,
  formatTokens,
  sparklinePoints,
  useContextSegmentVisible,
} from '../app/ContextRow';
import type { ThreadState } from '../state';

const metrics = {
  callCount: 84,
  compactionCount: 1,
  latestInputTokens: 99000,
  peakInputTokens: 120000,
  series: [20, 100, 40],
  partial: false,
};
const ok = (
  usage: { usedTokens: number; contextWindowTokens: number } | null = {
    usedTokens: 62400,
    contextWindowTokens: 200000,
  },
) => ({ ok: true, result: { state: 'ok', etag: '"v1"', summary: metrics, usage } });
const slots: ReturnType<typeof renderSlot>[] = [];
let serial = 0;
afterEach(async () => {
  for (const slot of slots.splice(0)) slot.lifecycle.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  vi.unstubAllGlobals();
});
async function mount(kind: 'card' | 'banner' = 'card', threadId = `thr_row${++serial}`) {
  const captured = await loadPluginApp(app);
  expect(captured.threadContextCardRows).toHaveLength(1);
  expect(captured.threadContextSegments).toHaveLength(1);
  const options = {
    pluginId: 'highwater-row-test',
    threadContextKind: kind,
    realtimeConnectionState: 'connected' as const,
    experimental_panel: { openTab: () => true },
  };
  const props = { threadId, projectId: 'proj_test', environment: null };
  const slot =
    kind === 'card'
      ? renderSlot(captured.threadContextCardRows[0], props, options)
      : renderSlot(
          {
            component: ({ threadId }: { threadId: string }) =>
              useContextSegmentVisible({ threadId }) ? (
                <ContextSegment threadId={threadId} />
              ) : null,
          },
          props,
          options,
        );
  slots.push(slot);
  return slot;
}

it.each([
  [0, '0'],
  [999, '999'],
  [62400, '62.4k'],
  [200000, '200k'],
  [1000000, '1m'],
])('formats %s tokens as %s', (value, expected) => {
  expect(formatTokens(value as number)).toBe(expected);
});
it('bounds sparkline geometry, including zero and single-point histories', () => {
  expect(sparklinePoints([0, 0])).toEqual([
    [1, 9],
    [63, 9],
  ]);
  expect(sparklinePoints([5])).toEqual([[32, 1]]);
  expect(sparklinePoints([20, 100, 40])).toEqual([
    [1, 13.8],
    [32, 1],
    [63, 10.6],
  ]);
});

describe('Context row and segment', () => {
  it.each(['card', 'banner'] as const)(
    'shows the same summary in the %s layout and opens the Context tab',
    async (kind) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(ok()));
      vi.stubGlobal('fetch', fetcher);
      const slot = await mount(kind);
      expect(await slot.findByText('84 calls · 1 compaction')).toBeTruthy();
      expect(slot.getByText('62.4k / 200k')).toBeTruthy();
      expect(slot.getByRole('img', { name: 'Reported input tokens per model call' })).toBeTruthy();
      // The displayed current usage is bb's 62.4k, not Highwater's 99k last reported input.
      expect(slot.queryByText('99k / 200k')).toBeNull();
      fireEvent.click(slot.getByRole('button', { name: /Context/ }));
      expect(slot.inspection.experimental_panelCalls).toMatchObject([
        {
          method: 'openTab',
          options: { tab: { id: 'context', context: { kind: 'thread' }, availability: 'action' } },
        },
      ]);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(String(fetcher.mock.calls[0][0])).toContain('/rpc/threadSummary');
      expect(fetcher.mock.calls.some(([url]) => String(url).includes('/http/analysis'))).toBe(
        false,
      );
    },
  );
  it('does not render or fetch a redundant segment while bb shows the card', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const captured = await loadPluginApp(app);
    const slot = renderSlot(
      { component: ContextSegment },
      { threadId: `thr_row${++serial}` },
      { threadContextKind: 'card' },
    );
    slots.push(slot);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(slot.container.textContent).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['unsupportedAgent', 'noSession'] as const)(
    'shows nothing for %s in either layout',
    async (state) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
        Response.json({
          ok: true,
          result: state === 'unsupportedAgent' ? { state, providerId: 'opencode' } : { state },
        }),
      );
      vi.stubGlobal('fetch', fetcher);
      const card = await mount('card');
      const banner = await mount('banner');
      await waitFor(() => {
        expect(card.container.textContent).toBe('');
        expect(banner.container.textContent).toBe('');
      });
    },
  );
  it('reveals a hidden no-session segment after the thread starts a session', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, result: { state: 'noSession' } }))
      .mockImplementation(async () => Response.json(ok()));
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_row${++serial}`;
    const slot = await mount('banner', threadId);
    await waitFor(() => expect(slot.container.textContent).toBe(''));
    await slot.behavior.emitRealtime('thread-advanced', { threadId, idle: false });
    await waitFor(() => expect(slot.getByText('84 calls · 1 compaction')).toBeTruthy(), {
      timeout: 4000,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('stops redundant realtime reads once an immutable unsupported provider is known', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json({ ok: true, result: { state: 'unsupportedAgent', providerId: 'opencode' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_row${++serial}`;
    const slot = await mount('card', threadId);
    await waitFor(() => expect(slot.container.textContent).toBe(''));
    await slot.behavior.emitRealtime('thread-advanced', { threadId, idle: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('shows a missing binary message that opens the tab', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () =>
          Response.json({ ok: true, result: { state: 'binaryMissing' } }),
        ),
    );
    const slot = await mount();
    expect(await slot.findByText('Highwater not installed')).toBeTruthy();
    fireEvent.click(slot.getByRole('button', { name: /Context/ }));
    expect(slot.inspection.experimental_panelCalls).toHaveLength(1);
    expect(slot.queryByRole('img', { name: 'Reported input tokens per model call' })).toBeNull();
  });
  it.each([null, { usedTokens: 0, contextWindowTokens: 200000 }])(
    'preserves unknown or zero usage: %s',
    async (usage) => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockImplementation(async () => Response.json(ok(usage))),
      );
      const slot = await mount();
      expect(await slot.findByText(usage ? '0 / 200k' : 'Usage unavailable')).toBeTruthy();
    },
  );
  it('does not draw a fabricated chart when reported token points are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () =>
        Response.json({
          ok: true,
          result: {
            ...ok().result,
            summary: { ...metrics, series: [], partial: true, latestInputTokens: null },
          },
        }),
      ),
    );
    const slot = await mount();
    expect(await slot.findByText('84 calls · 1 compaction · partial')).toBeTruthy();
    expect(slot.queryByRole('img', { name: 'Reported input tokens per model call' })).toBeNull();
  });
  it.each([
    [{ state: 'noEnvironment' }, 'No machine assigned'],
    [
      { state: 'unsupportedVersion', version: '9.0.0', accepted: '>=0.5.0 <0.6.0' },
      'Highwater version not supported',
    ],
    [
      { state: 'error', httpStatus: 503, code: 'busy', message: 'Please retry' },
      'Analysis could not be updated',
    ],
  ] as [ThreadState, string][])(
    'shows state %s without misleading token figures',
    async (state, text) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockImplementation(async () => Response.json({ ok: true, result: state })),
      );
      const slot = await mount();
      expect(await slot.findByText(text)).toBeTruthy();
      expect(slot.queryByText('62.4k / 200k')).toBeNull();
    },
  );
});
