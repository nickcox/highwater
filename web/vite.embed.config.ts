import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ compilerOptions: { css: 'injected' } })],
  build: {
    outDir: '../integrations/bb/vendor',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: 'src/embed.ts', formats: ['es'], fileName: () => 'highwater-embed.js' },
  },
});
