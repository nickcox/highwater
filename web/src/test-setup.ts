import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: TestResizeObserver,
  writable: true,
});

/** Node 25 and later replace jsdom's storage with its own, which is undefined
 * without --localstorage-file, so every Node version gets this one instead. */
class TestStorage implements Storage {
  #values = new Map<string, string>();
  get length(): number {
    return this.#values.size;
  }
  clear(): void {
    this.#values.clear();
  }
  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.#values.set(key, String(value));
  }
}

// A new, empty storage for each test, so saved settings never carry into the next test.
beforeEach(() => {
  for (const target of new Set([globalThis, window]))
    Object.defineProperty(target, 'localStorage', {
      value: new TestStorage(),
      configurable: true,
      writable: true,
    });
});
