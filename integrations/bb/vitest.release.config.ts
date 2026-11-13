import { defineConfig } from 'vitest/config';

// Explicit opt-in: this suite downloads public release assets and does not run in ordinary tests.
export default defineConfig({
  test: { include: ['tests/*.acceptance.ts'], testTimeout: 90_000, hookTimeout: 30_000 },
});
