import { describe, expect, it } from 'vitest';
import {
  assignItemColorSlots,
  contrastRatio,
  itemColor,
  itemTypeColor,
  textColorOn,
} from './colors';
import { ITEM_COLOR_SLOT_COUNT, paletteList, palettes } from '../theme/palettes';

/** Calls as stacks from the bottom up; an item first appears at the first call that lists it. */
function slotsFor(calls: string[][], takesPlaceOf = new Map<string, string>()) {
  const orderedItemIds: string[] = [];
  const firstModelCall = new Map<string, number>();
  for (const [index, ids] of calls.entries())
    for (const id of ids)
      if (!firstModelCall.has(id)) {
        orderedItemIds.push(id);
        firstModelCall.set(id, index + 1);
      }
  const items = orderedItemIds.map((id) => ({ id, firstModelCall: firstModelCall.get(id)! }));
  return assignItemColorSlots(
    items,
    orderedItemIds,
    new Map(calls.map((ids, index) => [index + 1, ids])),
    takesPlaceOf,
  );
}

describe('palette-aware chart colours', () => {
  for (const palette of paletteList) {
    it(`${palette.id}: gives every semantic kind a distinct visible colour`, () => {
      const colors = Object.values(palette.itemTypes);
      expect(colors).toHaveLength(11);
      expect(new Set(colors).size).toBe(11);
      for (const color of [...colors, ...palette.items])
        expect(contrastRatio(color, palette.tokens.plot)).toBeGreaterThanOrEqual(3);
      for (const kind of Object.keys(palette.itemTypes) as (keyof typeof palette.itemTypes)[])
        expect(itemTypeColor(kind, palette)).toBe(palette.itemTypes[kind]);
    });
    it(`${palette.id}: keeps translucent ribbon fills visible against the plot`, () => {
      for (const fill of [...palette.items, ...Object.values(palette.itemTypes)]) {
        const composite =
          '#' +
          [1, 3, 5]
            .map((offset) => {
              const foreground = Number.parseInt(fill.slice(offset, offset + 2), 16);
              const background = Number.parseInt(palette.tokens.plot.slice(offset, offset + 2), 16);
              return Math.round(foreground * 0.88 + background * 0.12)
                .toString(16)
                .padStart(2, '0');
            })
            .join('');
        expect(contrastRatio(composite, palette.tokens.plot)).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${palette.id}: chooses readable text on every item fill`, () => {
      for (const fill of palette.items)
        expect(contrastRatio(textColorOn(fill), fill)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('resolves different colours from the same stable slot map without mutating it', () => {
    const indexed = { itemColorSlotById: slotsFor([['a', 'b', 'c']]) };
    const before = [...indexed.itemColorSlotById];
    expect(itemColor(indexed, 'a', palettes.light)).not.toBe(
      itemColor(indexed, 'a', palettes.dark),
    );
    expect([...indexed.itemColorSlotById]).toEqual(before);
    expect(itemColor(indexed, 'missing', palettes.light)).toBe(palettes.light.items[0]);
  });
  it('retains the reviewed Dark category hues and item ordering', () => {
    expect(palettes.dark.itemTypes.userMessage).toBe('#7eafe3');
    expect(palettes.dark.itemTypes.toolResult).toBe('#dab66c');
    expect(palettes.dark.items).toEqual([
      '#8cacc9',
      '#83b8ac',
      '#c59b89',
      '#c5b080',
      '#b29fbd',
      '#bbb17d',
      '#80afbd',
      '#a1acbc',
      '#bf9bad',
      '#96b799',
    ]);
  });
});

describe('assignItemColorSlots', () => {
  it('avoids neighbouring slots while a free one remains', () => {
    const stack = Array.from({ length: 40 }, (_, index) => `item-${index}`);
    const calls = [stack, stack.filter((_, index) => index % 2 === 0)];
    const slots = slotsFor(calls);
    for (const ids of calls)
      for (let index = 1; index < ids.length; index += 1)
        expect(slots.get(ids[index]!)).not.toBe(slots.get(ids[index - 1]!));
  });
  it('inherits a replaced item slot, including slot zero', () => {
    const calls = [
      ['context-1', 'a'],
      ['context-2', 'b'],
    ];
    const slots = slotsFor(calls, new Map([['context-2', 'context-1']]));
    expect(slots.get('context-2')).toBe(slots.get('context-1'));
    const zeroId = Array.from({ length: 100 }, (_, i) => `zero-${i}`).find(
      (id) => slotsFor([[id]]).get(id) === 0,
    )!;
    expect(zeroId).toBeDefined();
    expect(
      slotsFor([[zeroId], ['replacement']], new Map([['replacement', zeroId]])).get('replacement'),
    ).toBe(0);
  });
  it('keeps assignments stable when live calls are appended', () => {
    const calls = [
      ['a', 'b'],
      ['a', 'b', 'c'],
    ];
    const before = slotsFor(calls);
    const after = slotsFor([...calls, ['a', 'b', 'c', 'd', 'e']]);
    for (const [id, slot] of before) expect(after.get(id)).toBe(slot);
    expect(slotsFor(calls)).toEqual(before);
  });
  it('uses the least used neighbour slot when every slot is taken', () => {
    const others = Array.from({ length: 11 }, (_, index) => `other-${index}`);
    const slots = slotsFor([others, ...others.map((id) => [id, 'item'])]);
    const uses = new Map<number, number>();
    for (const id of others) uses.set(slots.get(id)!, (uses.get(slots.get(id)!) ?? 0) + 1);
    const fewest = Math.min(
      ...Array.from({ length: ITEM_COLOR_SLOT_COUNT }, (_, slot) => uses.get(slot) ?? 0),
    );
    expect(uses.get(slots.get('item')!) ?? 0).toBe(fewest);
  });
});
