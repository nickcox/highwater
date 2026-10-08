import { afterEach, expect, it, vi } from 'vitest';
import { createOverlayFocus } from './overlay-focus';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

it('can focus an overlay and return target without scrolling', async () => {
  const button = document.createElement('button');
  document.body.append(button);
  const focus = vi.spyOn(button, 'focus');
  const owner = createOverlayFocus(() => Promise.resolve());
  owner.focusAfterUpdate(
    () => button,
    () => true,
    { preventScroll: true },
  );
  await Promise.resolve();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  owner.dispose();
});

it('rejects pending focus after close, replacement, disposal and superseding requests', async () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  const button = document.createElement('button');
  document.body.append(button);
  const focus = vi.spyOn(button, 'focus');
  const owner = createOverlayFocus(() => promise);
  owner.focusAfterUpdate(() => button);
  owner.cancel();
  resolve();
  await promise;
  expect(focus).not.toHaveBeenCalled();
  owner.focusAfterUpdate(
    () => button,
    () => false,
  );
  await promise;
  expect(focus).not.toHaveBeenCalled();
  owner.focusAfterUpdate(() => button);
  owner.dispose();
  await promise;
  expect(focus).not.toHaveBeenCalled();
  const next = createOverlayFocus(() => promise);
  next.focusAfterUpdate(() => button);
  next.focusAfterUpdate(() => button);
  await promise;
  expect(focus).toHaveBeenCalledOnce();
});

it('invalidates replacement work without cancelling an unchanged identity', async () => {
  const button = document.createElement('button');
  document.body.append(button);
  const focus = vi.spyOn(button, 'focus');
  const owner = createOverlayFocus(() => Promise.resolve());
  const identity = {};
  owner.observeIdentity(identity);
  owner.focusAfterUpdate(() => button);
  owner.observeIdentity({});
  await Promise.resolve();
  expect(focus).not.toHaveBeenCalled();
  owner.observeIdentity(identity);
  owner.focusAfterUpdate(() => button);
  owner.observeIdentity(identity);
  await Promise.resolve();
  expect(focus).toHaveBeenCalledOnce();
  owner.dispose();
});

it('does not focus hidden or disconnected targets and preserves deliberate return focus', async () => {
  const container = document.createElement('div');
  const button = document.createElement('button');
  container.append(button);
  document.body.append(container);
  container.hidden = true;
  const focus = vi.spyOn(button, 'focus');
  const owner = createOverlayFocus(() => Promise.resolve());
  owner.focusAfterUpdate(() => button);
  await Promise.resolve();
  expect(focus).not.toHaveBeenCalled();
  container.hidden = false;
  button.remove();
  owner.focusAfterUpdate(() => button);
  await Promise.resolve();
  expect(focus).not.toHaveBeenCalled();
  container.append(button);
  owner.focusAfterUpdate(() => button);
  await Promise.resolve();
  expect(focus).toHaveBeenCalledOnce();
});
