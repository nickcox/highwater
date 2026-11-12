import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshScheduler, type RefreshResult } from '../app/scheduler';
import { deferred } from './helpers';

const schedulers: RefreshScheduler[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  for (const scheduler of schedulers.splice(0)) scheduler.stop();
  vi.useRealTimers();
});
function setup(cycle: (signal: AbortSignal) => Promise<RefreshResult> = async () => ({})) {
  const starts: number[] = [];
  const work = vi.fn((signal: AbortSignal) => {
    starts.push(Date.now());
    return cycle(signal);
  });
  const scheduler = new RefreshScheduler(work, () => Date.now());
  schedulers.push(scheduler);
  scheduler.start();
  return { scheduler, work, starts };
}

describe('shared refresh scheduling', () => {
  it('coalesces signals, enforces two seconds between starts and does not poll', async () => {
    const { scheduler, starts } = setup();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 20; i++) scheduler.request();
    await vi.advanceTimersByTimeAsync(1999);
    expect(starts).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1);
    expect(starts).toEqual([0, 2000]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(starts).toHaveLength(2);
  });
  it('keeps a signal received in flight and waits five times the complete cycle duration', async () => {
    const pending = deferred<RefreshResult>();
    let count = 0;
    const { scheduler, starts } = setup(() =>
      ++count === 1 ? pending.promise : Promise.resolve({}),
    );
    await vi.advanceTimersByTimeAsync(1000);
    scheduler.request();
    await vi.advanceTimersByTimeAsync(900);
    pending.resolve({});
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(7599);
    expect(starts).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1);
    expect(starts).toEqual([0, 9500]);
  });
  it('does not let an in-flight request satisfy the final idle refresh', async () => {
    const pending = deferred<RefreshResult>();
    let count = 0;
    const { scheduler, starts } = setup(() =>
      ++count === 1 ? pending.promise : Promise.resolve({}),
    );
    await vi.advanceTimersByTimeAsync(500);
    scheduler.request({ idle: true });
    pending.resolve({});
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1999);
    expect(starts).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1);
    expect(starts).toEqual([0, 2500]);
  });
  it('retains an idle deadline when later normal signals cause an earlier refresh', async () => {
    const { scheduler, starts } = setup();
    await vi.advanceTimersByTimeAsync(3000);
    scheduler.request({ idle: true });
    await vi.advanceTimersByTimeAsync(200);
    scheduler.request();
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toEqual([0, 3200]);
    await vi.advanceTimersByTimeAsync(1999);
    expect(starts).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(starts).toEqual([0, 3200, 5200]);
  });
  it('retries a missing session three times, subject to the rate limit, then stops', async () => {
    const { scheduler, starts } = setup(async () => ({ sessionNotFound: true }));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(starts).toEqual([0, 2000, 4000, 6000]);
    scheduler.request({ retry: true });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(starts.slice(4)).toEqual([20000, 22000, 24000, 26000]);
  });
  it('resets the missing-session retry budget after success', async () => {
    let count = 0;
    const { scheduler, starts } = setup(async () => ({ sessionNotFound: ++count !== 2 }));
    await vi.advanceTimersByTimeAsync(6000);
    expect(starts).toEqual([0, 2000]);
    scheduler.request();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(starts.slice(2)).toEqual([6000, 8000, 10000, 12000]);
  });
  it('aborts work and timers when paused, without letting an old completion change resumed work', async () => {
    const pending = deferred<RefreshResult>();
    let signal!: AbortSignal;
    let count = 0;
    const { scheduler, starts } = setup((current) => {
      signal = current;
      return ++count === 1 ? pending.promise : Promise.resolve({});
    });
    await vi.advanceTimersByTimeAsync(0);
    scheduler.request({ idle: true });
    scheduler.stop();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(2000);
    pending.resolve({ sessionNotFound: true });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(starts).toEqual([0, 2000]);
  });
  it('keeps different threads independent', async () => {
    const a = setup(() => new Promise(() => {}));
    const b = setup();
    await vi.advanceTimersByTimeAsync(0);
    b.scheduler.request();
    await vi.advanceTimersByTimeAsync(2000);
    expect(a.starts).toEqual([0]);
    expect(b.starts).toEqual([0, 2000]);
  });
});
