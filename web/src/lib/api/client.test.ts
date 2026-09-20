import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAnalysis } from './client';

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
