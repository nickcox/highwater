// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, waitFor } from '@testing-library/react';
import { loadPluginApp, renderSlot } from '@get-bb/plugin-sdk/testing/app';
import app from '../app';
import {
  ContextSegment,
  forecast,
  GROWTH_EXPLANATION,
  formatTokens,
  sparklinePoints,
  useContextSegmentVisible,
} from '../app/ContextRow';
import type { ContextComposition, ThreadState } from '../state';
import { skippableTimers, wholeText } from './helpers';

const metrics = {
  callCount: 84,
  compactionCount: 1,
  latestInputTokens: 99000,
  peakInputTokens: 120000,
  series: [20, 100, 40],
  compactionPoints: [1],
  recentGrowth: 1200,
};
const composition: ContextComposition = {
  segments: [
    { kind: 'system', tokens: 2500 },
    { kind: 'customMessage', tokens: 1 },
    { kind: 'toolResult', tokens: 7499 },
  ],
  incomplete: true,
};
const ok = (
  usage: { usedTokens: number; contextWindowTokens: number } | null = {
    usedTokens: 62400,
    contextWindowTokens: 200000,
  },
  latestComposition: ContextComposition | null = composition,
) => ({
  ok: true,
  result: {
    state: 'ok',
    etag: '"v1"',
    summary: { ...metrics, ...(latestComposition ? { latestComposition } : {}) },
    usage,
  },
});
const slots: ReturnType<typeof renderSlot>[] = [];
let serial = 0;
afterEach(async () => {
  for (const slot of slots.splice(0)) slot.lifecycle.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function mount(
  kind: 'card' | 'banner' = 'card',
  threadId = `thr_row${++serial}`,
  settings?: { showContextSummary: boolean },
) {
  const captured = await loadPluginApp(app);
  expect(captured.threadContextCardRows).toHaveLength(1);
  expect(captured.threadContextSegments).toHaveLength(1);
  const options = {
    pluginId: 'highwater-row-test',
    threadContextKind: kind,
    realtimeConnectionState: 'connected' as const,
    experimental_panel: { openTab: () => true },
    settings,
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
it('bounds sparkline geometry against the given maximum, including zero and single points', () => {
  expect(sparklinePoints([0, 0], 0)).toEqual([
    [1, 17],
    [63, 17],
  ]);
  expect(sparklinePoints([5], 5)).toEqual([[32, 1]]);
  expect(sparklinePoints([20, 100, 40], 100)).toEqual([
    [1, 13.8],
    [32, 1],
    [63, 10.6],
  ]);
  // Against a window twice the peak, the peak reaches only halfway up.
  expect(sparklinePoints([100], 200)).toEqual([[32, 9]]);
});

it('leaves out compactions when there are none', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        ok: true,
        result: {
          ...ok().result,
          summary: { ...metrics, compactionCount: 0, compactionPoints: [] },
        },
      }),
    ),
  );
  const slot = await mount('card');
  expect(await slot.findByText(wholeText('84 calls · input +1.2k/call'))).toBeTruthy();
});
it('estimates calls until the window is full only from a positive recent rate', () => {
  const data = (recentGrowth: number | null, usedTokens = 62400) => ({
    state: 'ok' as const,
    etag: '"v1"',
    summary: { ...metrics, recentGrowth },
    usage: { usedTokens, contextWindowTokens: 200000 },
  });
  // (200,000 − 62,400) / 1,200 = 114.7: 115 calls, shown to the nearest 10.
  expect(forecast(data(1200))).toBe('Full in about 120 calls at the recent rate.');
  // Below 20 calls the exact number is shown.
  expect(forecast(data(1200, 190000))).toBe('Full in about 9 calls at the recent rate.');
  expect(forecast(data(0))).toBe('');
  expect(forecast(data(-300))).toBe('');
  expect(forecast(data(null))).toBe('');
  expect(forecast(data(1200, 200000))).toBe('');
});

describe('Context row and segment', () => {
  it.each(['card', 'banner'] as const)('disables the %s summary and its requests', async (kind) => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(ok()));
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_row${++serial}`;
    const slot = await mount(kind, threadId, { showContextSummary: false });
    await slot.behavior.emitRealtime('thread-advanced', { threadId, idle: false });
    expect(slot.container.textContent).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['card', 'banner'] as const)(
    'shows context usage in the %s layout and opens the Context tab',
    async (kind) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(ok()));
      vi.stubGlobal('fetch', fetcher);
      const slot = await mount(kind);
      expect(await slot.findByText(kind === 'card' ? '62.4k / 200k · 31%' : '31%')).toBeTruthy();
      if (kind === 'card') {
        expect(
          slot.getByText(wholeText('84 calls · 1 compaction · input +1.2k/call')),
        ).toBeTruthy();
        const chart = slot.getByRole('img', {
          name: 'Reported input tokens per model call, against the context window',
        });
        expect(chart.querySelector('[data-part="window"]')).not.toBeNull();
        expect(chart.querySelectorAll('[data-part="compaction"]')).toHaveLength(1);
        expect(chart.querySelector('[data-part="latest"]')).not.toBeNull();
        expect(chart.querySelector('title')?.textContent).toBe(
          'Input per call across the session. Dashed line: context window.',
        );
        expect(slot.getByText('input +1.2k/call')).toHaveProperty('title', GROWTH_EXPLANATION);
        expect(slot.container.querySelector('[data-context-composition]')).toBeNull();
      } else {
        const button = slot.getByRole('button', { name: /Open Context tab/ });
        expect(button.textContent).toBe('31%');
        const bar = button.querySelector('[data-context-composition]')!;
        expect(Array.from(bar.querySelectorAll('span'), (part) => part.style.width)).toEqual([
          '25%',
          '0.01%',
          '74.99%',
        ]);
        act(() => button.focus());
        const tooltip = await slot.findByRole('tooltip');
        const [heading, forecastLine] = tooltip.querySelectorAll('p');
        expect(heading.textContent).toBe('62k of 200k tokens (31%)');
        expect(forecastLine.textContent).toBe('Full in about 120 calls at the recent rate.');
        expect(tooltip.textContent).toContain('Latest call · share of estimated input tokens');
        expect(tooltip.textContent).toContain('Agent-added context');
        expect(Array.from(tooltip.querySelectorAll('dd'), (value) => value.textContent)).toEqual([
          '25% (2,500)',
          '<0.1% (1)',
          '75% (7,499)',
        ]);
        expect(tooltip.textContent).toContain(
          'Some items have partial or missing token estimates.',
        );
      }
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
  it('shows just the percentage in the banner when composition is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () => Response.json(ok(undefined, null))),
    );
    const slot = await mount('banner');
    expect(await slot.findByText('31%')).toBeTruthy();
    expect(slot.container.querySelector('[data-context-composition]')).toBeNull();
  });
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
    const skip = skippableTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true, result: { state: 'noSession' } }))
      .mockImplementation(async () => Response.json(ok()));
    vi.stubGlobal('fetch', fetcher);
    const threadId = `thr_row${++serial}`;
    const slot = await mount('banner', threadId);
    await waitFor(() => expect(slot.container.textContent).toBe(''));
    await slot.behavior.emitRealtime('thread-advanced', { threadId, idle: false });
    await skip();
    expect(await slot.findByText('31%')).toBeTruthy();
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
    expect(await slot.findByText('Highwater binary not found')).toBeTruthy();
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
      expect(await slot.findByText(usage ? '0 / 200k · 0%' : 'Usage unavailable')).toBeTruthy();
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
            summary: {
              ...metrics,
              series: [],
              compactionPoints: [],
              recentGrowth: null,
              latestInputTokens: null,
            },
          },
        }),
      ),
    );
    const slot = await mount();
    expect(await slot.findByText(wholeText('84 calls · 1 compaction'))).toBeTruthy();
    expect(slot.queryByRole('img', { name: /^Reported input tokens per model call/ })).toBeNull();
  });
  it.each([
    [{ state: 'noEnvironment' }, 'No machine assigned'],
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
