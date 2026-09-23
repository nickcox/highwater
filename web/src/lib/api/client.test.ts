import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAnalysis, fetchSessions } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAnalysis', () => {
  it('returns notModified for 304 without parsing JSON', async () => {
    const response = new Response(null, {
      status: 304,
      headers: { etag: '"analysis-v1"' },
    });
    const json = vi.spyOn(response, 'json');
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('If-None-Match')).toBe('"analysis-v1"');
      return response;
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAnalysis('session', undefined, '"analysis-v1"')).resolves.toEqual({
      status: 'notModified',
      etag: '"analysis-v1"',
    });
    expect(json).not.toHaveBeenCalled();
  });
});

describe('fetchSessions', () => {
  it('parses generation-scoped revision metadata as bigint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ sessions: [] }), {
      status: 200,
      headers: {
        etag: '"catalog-v4"',
        'X-TokenPlume-Server-Generation': '0123456789abcdef0123456789abcdef',
        'X-TokenPlume-Catalog-Revision': '18446744073709551615',
        'X-TokenPlume-Live-Updates': 'active',
      },
    })));
    await expect(fetchSessions()).resolves.toMatchObject({
      status: 'ok',
      revision: 18446744073709551615n,
      generation: '0123456789abcdef0123456789abcdef',
    });
  });

  it('preserves structured degraded refresh errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { code: 'CATALOG_REFRESH_UNAVAILABLE', message: 'catalogue refresh is unavailable' },
    }), { status: 503 })));
    await expect(fetchSessions()).rejects.toMatchObject({
      code: 'CATALOG_REFRESH_UNAVAILABLE',
      status: 503,
    });
  });
});
