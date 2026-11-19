import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EconomicsBreakdown from './EconomicsBreakdown.svelte';
import type { EconomicsEventBreakdown } from './economics-track';

afterEach(cleanup);

describe('EconomicsBreakdown', () => {
  it("opens a compaction's details, and inspects the call for every event", async () => {
    const breakdown = {
      id: 'cluster-1',
      events: [
        {
          id: 'compaction-3',
          kind: 'compaction',
          callIndex: 3,
          x: 10,
          label: 'Compaction before call 3',
        },
        {
          id: 'target-4',
          kind: 'targetChange',
          callIndex: 4,
          x: 12,
          label: 'Model / provider change',
        },
      ],
      callIndices: [3, 4],
      anchorX: 10,
      anchorY: 10,
      laneTop: 0,
      laneHeight: 20,
    } as unknown as EconomicsEventBreakdown;
    const onInspect = vi.fn();
    const onInspectCompaction = vi.fn();
    render(EconomicsBreakdown, {
      props: {
        breakdown,
        canZoomIn: true,
        onClose: () => {},
        onZoom: () => {},
        onInspect,
        onInspectCompaction,
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Compaction details' }));
    expect(onInspectCompaction).toHaveBeenCalledWith(3);
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect call 4' }));
    expect(onInspect).toHaveBeenCalledWith(4);
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect call 3' }));
    expect(onInspect).toHaveBeenCalledWith(3);
    expect(screen.getAllByRole('button', { name: 'Compaction details' })).toHaveLength(1);
  });
});
