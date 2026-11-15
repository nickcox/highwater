export interface PresentationPreferences {
  version: 1;
  river: {
    verticalScale: 'session' | 'visible';
    display: 'items' | 'itemTypes';
  };
  economics: {
    expanded: boolean;
    lastMode: 'cache' | 'cost';
    cacheView: 'tokens' | 'share';
  };
}

export const PRESENTATION_KEY = 'highwater.presentation.v1';
export function defaultPresentationPreferences(): PresentationPreferences {
  return {
    version: 1,
    river: { verticalScale: 'session', display: 'items' },
    economics: { expanded: false, lastMode: 'cache', cacheView: 'tokens' },
  };
}

type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'> | null;
const browserStorage: StorageAccess = () =>
  typeof window === 'undefined' ? null : window.localStorage;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Stored values override `base`, which a host can use to choose different starting values. */
export function parsePresentationPreferences(
  raw: string | null,
  base: PresentationPreferences = defaultPresentationPreferences(),
): PresentationPreferences {
  const result: PresentationPreferences = {
    version: 1,
    river: { ...base.river },
    economics: { ...base.economics },
  };
  if (!raw || raw.length > 4096) return result;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1) return result;
    if (object(value.river)) {
      if (value.river.verticalScale === 'session' || value.river.verticalScale === 'visible')
        result.river.verticalScale = value.river.verticalScale;
      if (value.river.display === 'items' || value.river.display === 'itemTypes')
        result.river.display = value.river.display;
    }
    if (object(value.economics)) {
      if (typeof value.economics.expanded === 'boolean')
        result.economics.expanded = value.economics.expanded;
      if (value.economics.lastMode === 'cache' || value.economics.lastMode === 'cost')
        result.economics.lastMode = value.economics.lastMode;
      if (value.economics.cacheView === 'tokens' || value.economics.cacheView === 'share')
        result.economics.cacheView = value.economics.cacheView;
    }
  } catch {
    // Malformed or inaccessible storage never prevents an investigation.
  }
  return result;
}

export function readPresentationPreferences(
  access: StorageAccess = browserStorage,
  key: string = PRESENTATION_KEY,
  base: PresentationPreferences = defaultPresentationPreferences(),
): PresentationPreferences {
  try {
    return parsePresentationPreferences(access()?.getItem(key) ?? null, base);
  } catch {
    return parsePresentationPreferences(null, base);
  }
}

export function writePresentationPreferences(
  value: PresentationPreferences,
  access: StorageAccess = browserStorage,
  key: string = PRESENTATION_KEY,
): void {
  try {
    access()?.setItem(key, JSON.stringify(parsePresentationPreferences(JSON.stringify(value))));
  } catch {
    // The per-App in-memory preference remains usable with blocked storage.
  }
}
