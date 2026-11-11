import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { themeHtml } from './scripts/theme-html.js';
export default defineConfig({ plugins: [themeHtml(), svelte()] });
