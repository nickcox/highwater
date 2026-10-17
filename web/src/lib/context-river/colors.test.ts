import { describe, expect, it } from 'vitest';
import {
  CHART_BACKGROUND,
  assignItemColors,
  contrastRatio,
  ITEM_PALETTE,
  ITEM_TYPE_PALETTE,
  itemTypeColor,
  textColorOn,
} from './colors';
import type { ContextItemKind } from '../types';

describe('item type colors', () => {
  it('assigns unique, explicit stable hues to all eleven semantic categories', () => {
    const kinds = Object.keys(ITEM_TYPE_PALETTE) as ContextItemKind[];
    expect(kinds).toHaveLength(11);
    expect(new Set(kinds.map(itemTypeColor)).size).toBe(11);
    expect(itemTypeColor('userMessage')).toBe('#7eafe3');
    expect(itemTypeColor('toolResult')).toBe('#dab66c');
    expect(itemTypeColor('assistantMessage')).toBe('#64c4af');
    expect(itemTypeColor('compactionSummary')).toBe('#bba0e3');
    expect(itemTypeColor('thinking')).toBe('#9ad3e6');
    kinds.reverse().forEach((kind) => expect(itemTypeColor(kind)).toBe(ITEM_TYPE_PALETTE[kind]));
  });
  it('keeps each semantic hue visible against the chart background', () => {
    for (const color of Object.values(ITEM_TYPE_PALETTE))
      expect(contrastRatio(color, CHART_BACKGROUND)).toBeGreaterThan(3);
  });
});

/** Calls as stacks from the bottom up; an item first appears at the first call that lists it. */
function colorsFor(calls: string[][], takesPlaceOf = new Map<string, string>()) {
  const orderedItemIds: string[] = [];
  const firstModelCall = new Map<string, number>();
  for (const [index, ids] of calls.entries())
    for (const id of ids)
      if (!firstModelCall.has(id)) {
        firstModelCall.set(id, index + 1);
        orderedItemIds.push(id);
      }
  const items = orderedItemIds.map((id) => ({ id, firstModelCall: firstModelCall.get(id)! }));
  const byCall = new Map(calls.map((ids, index) => [index + 1, ids]));
  return assignItemColors(items, orderedItemIds, byCall, takesPlaceOf);
}

describe('assignItemColors', () => {
  it('never gives neighbouring bands the same colour while a free colour remains', () => {
    const stack = Array.from({ length: 40 }, (_, index) => `item-${index}`);
    // Dropping every other item makes new neighbours at the second call.
    const calls = [stack, stack.filter((_, index) => index % 2 === 0)];
    const colors = colorsFor(calls);
    for (const ids of calls)
      for (let index = 1; index < ids.length; index += 1)
        expect(colors.get(ids[index]!)).not.toBe(colors.get(ids[index - 1]!));
  });

  it("gives an item that takes the place of another that item's colour", () => {
    const colors = colorsFor(
      [
        ['context-1', 'a'],
        ['context-2', 'b'],
      ],
      new Map([['context-2', 'context-1']]),
    );
    expect(colors.get('context-2')).toBe(colors.get('context-1'));
  });

  it('keeps the colours already shown when a live session adds a call', () => {
    const calls = [
      ['a', 'b'],
      ['a', 'b', 'c'],
    ];
    const before = colorsFor(calls);
    const after = colorsFor([...calls, ['a', 'b', 'c', 'd', 'e']]);
    for (const [id, color] of before) expect(after.get(id)).toBe(color);
  });

  it('uses the colour its neighbours use least when every colour is taken', () => {
    const others = Array.from({ length: 11 }, (_, index) => `other-${index}`);
    // The item sits above a different one of the others at each later call.
    const colors = colorsFor([others, ...others.map((id) => [id, 'item'])]);
    const uses = new Map<string, number>();
    for (const id of others) uses.set(colors.get(id)!, (uses.get(colors.get(id)!) ?? 0) + 1);
    const fewest = Math.min(...ITEM_PALETTE.map((color) => uses.get(color) ?? 0));
    expect(uses.get(colors.get('item')!) ?? 0).toBe(fewest);
  });

  it('chooses readable Composition text for every palette colour', () => {
    for (const color of ITEM_PALETTE)
      expect(contrastRatio(textColorOn(color), color)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses palette colors with reviewed dark-background contrast', () => {
    expect(ITEM_PALETTE).toHaveLength(10);
    for (const color of ITEM_PALETTE)
      expect(contrastRatio(color, CHART_BACKGROUND)).toBeGreaterThan(3);
  });
});
