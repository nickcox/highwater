import type { ContextItem, ContextItemKind, IndexedAnalysis } from '../types';

// Semantic categories use explicit hues, not individual-ID hash slots.
export const ITEM_TYPE_PALETTE = {
  system: '#aab4c0',
  toolDefinition: '#e2957b',
  userMessage: '#7eafe3',
  assistantMessage: '#64c4af',
  toolResult: '#dab66c',
  compactionSummary: '#bba0e3',
  customMessage: '#da8faf',
  branchSummary: '#b8c879',
  thinking: '#9ad3e6',
  unrecordedContext: '#b5a58f',
  other: '#d9d4c9',
} as const satisfies Record<ContextItemKind, string>;

export function itemTypeColor(kind: ContextItemKind): string {
  return ITEM_TYPE_PALETTE[kind] ?? ITEM_TYPE_PALETTE.other;
}

export const ITEM_PALETTE = [
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
] as const;

// Matches --plot in workspace.css; tested against actual browser backgrounds.
export const CHART_BACKGROUND = '#131b21';

/** An item's colour in Items view, from the session's colour table. */
export function itemColor(indexed: Pick<IndexedAnalysis, 'itemColorById'>, id: string): string {
  return indexed.itemColorById.get(id) ?? ITEM_PALETTE[0];
}

/** Near-black or white, whichever contrasts more with the fill. */
export function textColorOn(fill: string): string {
  return contrastRatio('#11171c', fill) >= contrastRatio('#ffffff', fill) ? '#11171c' : '#ffffff';
}

/** Where an item starts looking for a free colour, so colours vary between items. */
function paletteStart(id: string): number {
  let hash = 2_166_136_261;
  for (const character of id) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16_777_619);
  }
  return (hash >>> 0) % ITEM_PALETTE.length;
}

/**
 * Each item's colour in Items view. Items are coloured in the order they first appear, so a live
 * session's new items do not change the colours already shown. (An item can still change colour
 * when an item between it and an earlier neighbour leaves the context and the two become neighbours.) An item that takes the place of an
 * earlier one keeps its colour. Any other item gets a colour that no item directly above or below
 * it at any call already has, or the one fewest of them have when all are taken.
 */
export function assignItemColors(
  items: readonly Pick<ContextItem, 'id' | 'firstModelCall'>[],
  orderedItemIds: readonly string[],
  orderedItemIdsByCall: ReadonlyMap<number, readonly string[]>,
  takesPlaceOf: ReadonlyMap<string, string>,
): Map<string, string> {
  const rank = new Map(orderedItemIds.map((id, index) => [id, index]));
  const count = orderedItemIds.length;
  const pairs = new Set<number>();
  for (const ids of orderedItemIdsByCall.values()) {
    for (let index = 1; index < ids.length; index += 1) {
      const below = rank.get(ids[index - 1]!);
      const above = rank.get(ids[index]!);
      if (below !== undefined && above !== undefined)
        pairs.add(Math.min(below, above) * count + Math.max(below, above));
    }
  }
  const neighbours = new Map<string, string[]>();
  for (const pair of pairs) {
    const [low, high] = [orderedItemIds[Math.floor(pair / count)]!, orderedItemIds[pair % count]!];
    for (const [id, other] of [
      [low, high],
      [high, low],
    ]) {
      const list = neighbours.get(id);
      if (list) list.push(other);
      else neighbours.set(id, [other]);
    }
  }

  const colors = new Map<string, string>();
  const order = [...items].sort(
    (left, right) =>
      left.firstModelCall - right.firstModelCall ||
      (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0),
  );
  for (const { id } of order) {
    const inherited = colors.get(takesPlaceOf.get(id) ?? '');
    if (inherited) {
      colors.set(id, inherited);
      continue;
    }
    const used = new Map<string, number>();
    for (const neighbour of neighbours.get(id) ?? []) {
      const color = colors.get(neighbour);
      if (color) used.set(color, (used.get(color) ?? 0) + 1);
    }
    const start = paletteStart(id);
    let best: string = ITEM_PALETTE[start]!;
    for (let step = 0, fewest = Infinity; step < ITEM_PALETTE.length && fewest > 0; step += 1) {
      const color = ITEM_PALETTE[(start + step) % ITEM_PALETTE.length]!;
      const uses = used.get(color) ?? 0;
      if (uses < fewest) [best, fewest] = [color, uses];
    }
    colors.set(id, best);
  }
  return colors;
}

function luminance(hex: string): number {
  const values = [1, 3, 5].map((offset) => {
    const component = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}
