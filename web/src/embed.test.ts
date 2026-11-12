import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/svelte';
import {
  mountHighwater,
  type HighwaterEmbed,
} from '../../integrations/bb/vendor/highwater-embed.js';
import { testAnalysis } from './lib/context-river/test-data';
import { toWireAnalysis } from './lib/testing/wire-analysis';

let embed: HighwaterEmbed | undefined;
let host: HTMLElement;
afterEach(() => {
  embed?.destroy();
  embed = undefined;
  host?.remove();
  vi.unstubAllGlobals();
});

describe('built embeddable session view', () => {
  it('mounts styles and the view only inside its shadow root and can remount after destroy', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const previousHead = document.head.innerHTML;
    const previousTheme = document.documentElement.getAttribute('data-theme');
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    const loadAnalysis = vi.fn(async () => ({
      status: 'ok' as const,
      etag: 'v1',
      analysis: toWireAnalysis(testAnalysis()),
    }));
    embed = mountHighwater({
      target: host,
      theme: 'light',
      preferencesKey: 'test.embed.presentation',
      loadAnalysis,
    });
    await waitFor(() => expect(host.shadowRoot?.querySelector('.river-scroll')).not.toBeNull());
    expect(host.shadowRoot?.querySelectorAll('style').length).toBeGreaterThan(1);
    expect(host.shadowRoot?.textContent).toContain('Context River');
    expect(document.querySelector('.river-scroll')).toBeNull();
    expect(document.head.innerHTML).toBe(previousHead);
    embed.setTheme('dark');
    expect(host.dataset.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe(previousTheme);
    expect(localStorage.getItem('highwater.theme.v1')).toBeNull();
    embed.destroy();
    expect(host.shadowRoot?.childNodes.length).toBe(0);
    expect(host.hasAttribute('data-theme')).toBe(false);
    embed = mountHighwater({
      target: host,
      theme: 'light',
      preferencesKey: 'test.embed.presentation',
      loadAnalysis,
    });
    await waitFor(() => expect(host.shadowRoot?.querySelector('.river-scroll')).not.toBeNull());
  });
});
