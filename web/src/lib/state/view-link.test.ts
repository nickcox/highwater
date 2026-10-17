import { describe, expect, it } from 'vitest';
import { indexTestAnalysis } from '../testing/wire-analysis';
import { testAnalysis } from '../context-river/test-data';
import {
  parseViewLink,
  serializeViewLink,
  validateViewLink,
  viewLinkSignature,
  viewLinkRange,
  type ViewLinkState,
} from './view-link';
const state: ViewLinkState = {
  session: 'opaque & unicode α',
  view: 'composition',
  display: 'itemTypes',
  scope: 'atCall',
  range: [2, 4],
  pin: 3,
  item: 'a',
};
describe('bounded unversioned v1 view links', () => {
  it('round-trips only navigation fields through a fragment', () => {
    expect(parseViewLink(serializeViewLink(state))).toEqual({ state, notice: '' });
    expect(serializeViewLink(state)).toMatch(/^#session=/);
    expect(serializeViewLink(state)).not.toMatch(/(?:#|&)(?:tp|v)=/);
    expect(parseViewLink('#view=river&session=pi-123456789abc').state?.session).toBe(
      'pi-123456789abc',
    );
    const boundedUnicode = { ...state, session: '漢'.repeat(512), item: '字'.repeat(512) };
    expect(parseViewLink(serializeViewLink(boundedUnicode))).toEqual({
      state: boundedUnicode,
      notice: '',
    });
    expect(serializeViewLink({ ...state, range: null, pin: null, item: null })).not.toMatch(
      /(?:#|&)(?:range|pin|item)=/,
    );
  });
  it('ignores foreign anchors and rejects unsupported versions, duplicate keys and oversized links', () => {
    expect(parseViewLink('#selected-item-summary').state).toBeNull();
    for (const hash of [
      '#v=2&session=x',
      '#session=x&v=2',
      '#session=x&pin=1&pin=2',
      '#session=',
      '#session=' + 'x'.repeat(16400),
    ])
      expect(parseViewLink(hash).notice).not.toBe('');
  });
  it('uses the supplied saved display default unless a valid URL value overrides it', () => {
    expect(parseViewLink('#session=x').state?.display).toBe('items');
    expect(parseViewLink('#session=x', 'itemTypes').state?.display).toBe('itemTypes');
    expect(parseViewLink('#session=x&display=items', 'itemTypes').state?.display).toBe('items');
    expect(parseViewLink('#session=x&display=bad', 'itemTypes').state?.display).toBe('itemTypes');
    expect(parseViewLink('#session=x&display=items').state?.display).toBe('items');
    expect(parseViewLink('#session=x&display=itemTypes').state?.display).toBe('itemTypes');
    const invalid = parseViewLink('#session=x&display=bad');
    expect(invalid.state?.display).toBe('items');
    expect(invalid.notice).not.toBe('');
    expect(parseViewLink('#session=x&display=items&display=itemTypes').state).toBeNull();
    expect(viewLinkSignature(state, 0)).not.toBe(
      viewLinkSignature({ ...state, display: 'items' }, 0),
    );
  });

  it('normalizes ranges and drops malformed optional fields without discarding the session', () => {
    expect(parseViewLink('#session=x&range=4:2').state?.range).toEqual([2, 4]);
    for (const value of ['0', '-1', '1.2', 'Infinity', '9007199254740992']) {
      const parsed = parseViewLink(
        '#session=x&pin=' + value + '&range=1:' + value + '&item=%00&view=bad&scope=bad',
      );
      expect(parsed.state).toMatchObject({
        session: 'x',
        range: null,
        pin: null,
        item: null,
        view: 'river',
        scope: 'cumulative',
      });
      expect(parsed.notice).not.toBe('');
    }
  });
  it('validates references against real calls/items without moving or clearing an absent selected item', () => {
    const indexed = indexTestAnalysis(testAnalysis());
    expect(validateViewLink(state, indexed).state).toEqual(state); // a is absent at call 3, but remains selected
    const result = validateViewLink({ ...state, pin: 99, item: 'gone', range: [1, 99] }, indexed);
    expect(result.state).toMatchObject({ pin: null, item: null, range: null });
    expect(result.notice).not.toBe('');
  });
  it('opens a parent from a child session at the tool call that started it', () => {
    const analysis = testAnalysis();
    analysis.contextItems.find((item) => item.id === 'a')!.metadata.childSession = 'child-1';
    const indexed = indexTestAnalysis(analysis);
    const parsed = parseViewLink('#session=parent&child=child-1').state!;
    expect(parsed.child).toBe('child-1');

    const result = validateViewLink(parsed, indexed);
    expect(result.state).toMatchObject({ item: 'a', pin: 1, child: null });
    expect(result.notice).toBe('');
    expect(serializeViewLink(result.state)).not.toContain('child=');

    const unknown = validateViewLink({ ...parsed, child: 'child-2' }, indexed);
    expect(unknown.state).toMatchObject({ item: null, pin: null });
    expect(unknown.notice).toBe('');
  });
  it('uses adjacent real call bounds for zoomed gaps, not an invented call or accidental Fit all', () => {
    const viewport = {
      ready: true,
      isFitAll: false,
      zoomFactor: 2,
      canZoomIn: true,
      canZoomOut: true,
      totalCallCount: 3,
      hasOverflow: true,
      firstVisibleCallIndex: null,
      lastVisibleCallIndex: null,
      centerCallIndex: 3,
    };
    expect(viewLinkRange(viewport, [1, 3, 7])).toEqual([1, 7]);
    expect(viewLinkRange({ ...viewport, isFitAll: true }, [1, 3, 7])).toBeNull();
    expect(
      viewLinkRange({ ...viewport, firstVisibleCallIndex: 3, lastVisibleCallIndex: 7 }, [1, 3, 7]),
    ).toEqual([3, 7]);
    expect(viewLinkRange(viewport, [])).toBeNull();
  });

  it('does not make range-only movement an explicit history navigation', () => {
    expect(viewLinkSignature(state, 2)).toBe(viewLinkSignature({ ...state, range: [1, 3] }, 2));
    expect(viewLinkSignature(state, 2)).not.toBe(viewLinkSignature({ ...state, pin: 4 }, 2));
    expect(viewLinkSignature(state, 2)).not.toBe(viewLinkSignature(state, 3));
  });
});
