import { describe, expect, it } from 'vitest';
import {
  normaliseSections,
  PANEL_SECTIONS,
  STANDARD_SECTIONS,
  wideSectionPlacement,
} from './session-sections';

describe('section order', () => {
  it('uses the preset when no order is requested', () => {
    expect(normaliseSections(undefined)).toEqual(STANDARD_SECTIONS);
    expect(normaliseSections(undefined, PANEL_SECTIONS)).toEqual(PANEL_SECTIONS);
  });
  it('drops unknown and repeated sections', () => {
    expect(
      normaliseSections(['chart', 'unknown', 'summary', 'chart', 7, 'details', 'lifespans']),
    ).toEqual(['chart', 'summary', 'details', 'lifespans']);
  });
  it('adds missing preset sections after the preset section before them', () => {
    expect(normaliseSections(['lifespans', 'chart'], PANEL_SECTIONS)).toEqual([
      'summary',
      'call',
      'lifespans',
      'chart',
      'details',
    ]);
    expect(normaliseSections([], STANDARD_SECTIONS)).toEqual(STANDARD_SECTIONS);
  });
  it('keeps a section outside the preset when it is requested', () => {
    expect(normaliseSections(['call', 'summary'], STANDARD_SECTIONS)).toEqual([
      'call',
      'summary',
      'chart',
      'details',
      'lifespans',
    ]);
  });
});

describe('wide placement', () => {
  const rows = (sections: Parameters<typeof wideSectionPlacement>[0]) =>
    Object.fromEntries(wideSectionPlacement(sections));
  it('puts details beside the chart and lifespans in the standard order', () => {
    expect(rows(STANDARD_SECTIONS)).toEqual({
      summary: { column: '1 / -1', row: '1' },
      chart: { column: '1', row: '2' },
      lifespans: { column: '1', row: '3' },
      details: { column: '2', row: '2 / span 2' },
    });
  });
  it('keeps full-width sections above the details column', () => {
    expect(rows(PANEL_SECTIONS)).toEqual({
      summary: { column: '1 / -1', row: '1' },
      call: { column: '1 / -1', row: '2' },
      chart: { column: '1', row: '3' },
      lifespans: { column: '1', row: '4' },
      details: { column: '2', row: '3 / span 2' },
    });
  });
  it('spans only the run of column-one sections next to the details', () => {
    expect(rows(['chart', 'details', 'call', 'lifespans', 'summary'])).toMatchObject({
      chart: { row: '1' },
      call: { row: '2' },
      lifespans: { row: '3' },
      details: { column: '2', row: '1 / span 1' },
    });
  });
  it('gives details a full-width row when no column-one section is next to them', () => {
    expect(rows(['summary', 'details', 'call', 'chart'])).toEqual({
      summary: { column: '1 / -1', row: '1' },
      details: { column: '1 / -1', row: '2' },
      call: { column: '1 / -1', row: '3' },
      chart: { column: '1', row: '4' },
    });
  });
});
