import { describe, expect, it } from 'vitest';
import {
  CHART_BACKGROUND,
  contrastRatio,
  itemColor,
  itemTextColor,
  ITEM_PALETTE,
  ITEM_TYPE_PALETTE,
  itemTypeColor,
} from './colors';
import type { ContextItemKind } from '../types';

describe('item type colors', () => {
  it('assigns unique, explicit stable hues to all nine semantic categories', () => {
    const kinds = Object.keys(ITEM_TYPE_PALETTE) as ContextItemKind[];
    expect(kinds).toHaveLength(9);
    expect(new Set(kinds.map(itemTypeColor)).size).toBe(9);
    expect(itemTypeColor('userMessage')).toBe('#7eafe3');
    expect(itemTypeColor('toolResult')).toBe('#dab66c');
    expect(itemTypeColor('assistantMessage')).toBe('#64c4af');
    expect(itemTypeColor('compactionSummary')).toBe('#bba0e3');
    kinds.reverse().forEach((kind) => expect(itemTypeColor(kind)).toBe(ITEM_TYPE_PALETTE[kind]));
  });
  it('keeps each semantic hue visible against the chart background', () => {
    for (const color of Object.values(ITEM_TYPE_PALETTE))
      expect(contrastRatio(color, CHART_BACKGROUND)).toBeGreaterThan(3);
  });
});

describe('itemColor', () => {
  it('is stable by ID and independent of ordering', () => {
    const ids = ['alpha', 'beta', 'gamma'];
    const first = new Map(ids.map((id) => [id, itemColor(id)]));
    ids.reverse().forEach((id) => expect(itemColor(id)).toBe(first.get(id)));
  });

  it('retains stable ten-slot hashing including Unicode IDs', () => {
    expect(ITEM_PALETTE).toHaveLength(10);
    for (const id of ['alpha', 'beta', '工具:🪶', 'é', '🪶']) {
      let hash = 2166136261;
      for (const character of id) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
      expect(itemColor(id)).toBe(ITEM_PALETTE[(hash >>> 0) % 10]);
    }
  });
  it('chooses readable Composition text for every palette slot', () => {
    for (let index = 0; index < 200; index++)
      expect(
        contrastRatio(itemTextColor(String(index)), itemColor(String(index))),
      ).toBeGreaterThanOrEqual(4.5);
  });

  it('uses palette colors with reviewed dark-background contrast', () => {
    for (const color of ITEM_PALETTE)
      expect(contrastRatio(color, CHART_BACKGROUND)).toBeGreaterThan(3);
  });
});
