import { describe, expect, it } from 'vitest';
import { CHART_BACKGROUND, contrastRatio, itemColor, itemTextColor, ITEM_PALETTE } from './colors';

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
