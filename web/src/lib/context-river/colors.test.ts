import { describe, expect, it } from 'vitest';
import { CHART_BACKGROUND, contrastRatio, itemColor, ITEM_PALETTE } from './colors';

describe('itemColor', () => {
  it('is stable by ID and independent of ordering', () => {
    const ids = ['alpha', 'beta', 'gamma'];
    const first = new Map(ids.map((id) => [id, itemColor(id)]));
    ids.reverse().forEach((id) => expect(itemColor(id)).toBe(first.get(id)));
  });

  it('is deterministic for Unicode IDs', () => {
    expect(itemColor('工具:🪶')).toBe(itemColor('工具:🪶'));
  });

  it('uses palette colors with reviewed dark-background contrast', () => {
    for (const color of ITEM_PALETTE) expect(contrastRatio(color, CHART_BACKGROUND)).toBeGreaterThan(3);
  });
});
