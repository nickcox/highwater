import { describe, expect, it, vi } from 'vitest';
import {
  defaultPresentationPreferences,
  parsePresentationPreferences,
  readPresentationPreferences,
  writePresentationPreferences,
  PRESENTATION_KEY,
} from './presentation-preferences';

describe('presentation preferences', () => {
  it('rejects malformed, oversized, unknown-version and non-object payloads', () => {
    for (const raw of [null, '{', 'null', '[]', 'false', '{"version":2}', ' '.repeat(4097)])
      expect(parsePresentationPreferences(raw)).toEqual(defaultPresentationPreferences());
  });
  it('validates fields independently and discards all unknown/private fields', () => {
    expect(
      parsePresentationPreferences(
        JSON.stringify({
          version: 1,
          sessionId: 'private',
          river: {
            verticalScale: 'visible',
            layout: 'bad',
            display: 'itemTypes',
            selectedId: 'private',
          },
          economics: { expanded: 'true', lastMode: 'cost', cacheView: 'share' },
        }),
      ),
    ).toEqual({
      version: 1,
      river: { verticalScale: 'visible', display: 'itemTypes' },
      economics: { expanded: false, lastMode: 'cost', cacheView: 'share' },
    });
  });
  it('ignores retired layout fields while preserving other preferences and strips them on writes', () => {
    const legacy = JSON.stringify({
      version: 1,
      river: { layout: 'compact', verticalScale: 'visible', display: 'itemTypes' },
      economics: { expanded: true, lastMode: 'cost', cacheView: 'share' },
    });
    const storage = { getItem: vi.fn(() => legacy), setItem: vi.fn() };
    const parsed = readPresentationPreferences(() => storage);
    expect(parsed.river).toEqual({ verticalScale: 'visible', display: 'itemTypes' });
    expect(parsed.economics).toEqual({ expanded: true, lastMode: 'cost', cacheView: 'share' });
    expect(storage.setItem).not.toHaveBeenCalled();
    writePresentationPreferences(parsed, () => storage);
    expect(JSON.parse(storage.setItem.mock.calls[0][1]).river).not.toHaveProperty('layout');
  });
  it('handles missing and throwing storage without alerts', () => {
    expect(readPresentationPreferences(() => null)).toEqual(defaultPresentationPreferences());
    const throwing = () => {
      throw new Error('blocked');
    };
    expect(readPresentationPreferences(throwing)).toEqual(defaultPresentationPreferences());
    expect(() =>
      writePresentationPreferences(defaultPresentationPreferences(), throwing),
    ).not.toThrow();
  });
  it('reads without writing; writes only clean preferences on explicit request', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const first = readPresentationPreferences(() => storage);
    const second = readPresentationPreferences(() => storage);
    first.river.verticalScale = 'visible';
    expect(second.river.verticalScale).toBe('session');
    expect(storage.setItem).not.toHaveBeenCalled();
    writePresentationPreferences(first, () => storage);
    expect(storage.setItem).toHaveBeenCalledWith(PRESENTATION_KEY, JSON.stringify(first));
    writePresentationPreferences(defaultPresentationPreferences(), () => storage);
    expect(JSON.parse(storage.setItem.mock.calls[1][1])).toEqual(defaultPresentationPreferences());
  });
});
