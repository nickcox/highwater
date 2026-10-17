import type { IndexedAnalysis } from '../types';
import type { RiverViewportStatus } from '../context-river/viewport';

export interface ViewLinkState {
  session: string;
  view: 'river' | 'composition';
  display: 'items' | 'itemTypes';
  scope: 'atCall' | 'cumulative';
  range: [number, number] | null;
  pin: number | null;
  item: string | null;
  /** Opened from this child session: select the tool call that started it. Never serialised;
   * once the session loads it becomes `item` and `pin`. */
  child?: string | null;
}
const identifier = (value: string | null) =>
  value !== null && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
const call = (value: string | null): number | null =>
  value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

/** Navigation fragments are unversioned v1; future explicit versions use `v`. */
export function isViewLinkFragment(hash: string): boolean {
  if (!hash) return false;
  if (hash.length > 16384) return hash.startsWith('#session=') || hash.startsWith('#v=');
  const params = new URLSearchParams(hash.slice(1));
  return params.has('session') || params.has('v');
}

export function parseViewLink(
  hash: string,
  defaultDisplay: ViewLinkState['display'] = 'items',
): { state: ViewLinkState | null; notice: string } {
  if (!isViewLinkFragment(hash)) return { state: null, notice: '' };
  const invalid = {
    state: null,
    notice: 'This view link is invalid or uses an unsupported version; showing the default view.',
  };
  if (hash.length > 16384) return invalid;
  const params = new URLSearchParams(hash.slice(1));
  if ((params.get('v') ?? '1') !== '1' || !identifier(params.get('session'))) return invalid;
  for (const key of ['v', 'session', 'view', 'display', 'scope', 'range', 'pin', 'item', 'child'])
    if (params.getAll(key).length > 1) return invalid;
  let ignored = false;
  let range: [number, number] | null = null;
  if (params.has('range')) {
    const parts = params.get('range')!.split(':');
    const start = call(parts[0] ?? null),
      end = call(parts[1] ?? null);
    if (parts.length === 2 && start !== null && end !== null)
      range = [Math.min(start, end), Math.max(start, end)];
    else ignored = true;
  }
  const pin = call(params.get('pin'));
  const item = identifier(params.get('item')) ? params.get('item') : null;
  const child = identifier(params.get('child')) ? params.get('child') : null;
  const view = params.get('view') === 'composition' ? 'composition' : 'river';
  const scope = params.get('scope') === 'atCall' ? 'atCall' : 'cumulative';
  const requestedDisplay = params.get('display');
  const display =
    requestedDisplay === 'items' || requestedDisplay === 'itemTypes'
      ? requestedDisplay
      : defaultDisplay;
  ignored ||=
    (params.has('pin') && pin === null) ||
    (params.has('item') && item === null) ||
    (params.has('child') && child === null) ||
    (params.has('view') && !['river', 'composition'].includes(params.get('view')!)) ||
    (params.has('scope') && !['atCall', 'cumulative'].includes(params.get('scope')!)) ||
    (params.has('display') && !['items', 'itemTypes'].includes(params.get('display')!));
  return {
    state: {
      session: params.get('session')!,
      view,
      display,
      scope,
      range,
      pin,
      item,
      ...(child === null ? {} : { child }),
    },
    notice: ignored ? 'Some invalid view-link settings were ignored.' : '',
  };
}

export function serializeViewLink(state: ViewLinkState): string {
  const params = new URLSearchParams({
    session: state.session,
    view: state.view,
    display: state.display,
    scope: state.scope,
  });
  if (state.range) params.set('range', state.range.join(':'));
  if (state.pin !== null) params.set('pin', String(state.pin));
  if (state.item !== null) params.set('item', state.item);
  return `#${params}`;
}

export function validateViewLink(
  state: ViewLinkState,
  indexed: IndexedAnalysis,
): { state: ViewLinkState; notice: string } {
  if (state.child) {
    // The tool call's result, at the call it first appears in. A child started from a call that
    // is not on the shown branch has none, and the parent opens without a selection.
    const started = indexed.analysis.contextItems.find(
      (item) => item.metadata.childSession === state.child && item.presence.length > 0,
    );
    state = {
      ...state,
      child: null,
      item: started?.id ?? state.item,
      pin: started?.firstModelCall ?? state.pin,
    };
  }
  let ignored = false;
  const pin = state.pin !== null && indexed.callByIndex.has(state.pin) ? state.pin : null;
  const item = state.item !== null && indexed.itemById.has(state.item) ? state.item : null;
  const range =
    state.range && state.range.every((index) => indexed.callByIndex.has(index))
      ? state.range
      : null;
  ignored = pin !== state.pin || item !== state.item || range !== state.range;
  return {
    state: { ...state, pin, item, range },
    notice: ignored
      ? 'Some calls or items in this view link are no longer available; unavailable settings were ignored.'
      : '',
  };
}

/** Capture real call bounds; a highly zoomed empty gap uses adjacent real calls. */
export function viewLinkRange(
  viewport: RiverViewportStatus,
  calls: readonly number[],
): ViewLinkState['range'] {
  if (!viewport.ready || viewport.isFitAll || calls.length === 0) return null;
  if (viewport.firstVisibleCallIndex !== null && viewport.lastVisibleCallIndex !== null)
    return [viewport.firstVisibleCallIndex, viewport.lastVisibleCallIndex];
  const position = calls.indexOf(viewport.centerCallIndex ?? -1);
  return position < 0
    ? null
    : [calls[Math.max(0, position - 1)], calls[Math.min(calls.length - 1, position + 1)]];
}

/** Hover and pixel geometry never enter this explicit navigation signature. */
export function viewLinkSignature(state: ViewLinkState, navigationRevision: number | null): string {
  return JSON.stringify([
    state.session,
    state.view,
    state.display,
    state.scope,
    state.pin,
    state.item,
    navigationRevision,
  ]);
}
