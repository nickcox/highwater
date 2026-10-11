import type { ContextItemKind } from '../types';

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

export function itemTextColor(id: string): string {
  const fill = itemColor(id);
  return contrastRatio('#11171c', fill) >= contrastRatio('#ffffff', fill) ? '#11171c' : '#ffffff';
}

export function itemColor(id: string): string {
  let hash = 2_166_136_261;
  for (const character of id) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 16_777_619);
  }
  return ITEM_PALETTE[(hash >>> 0) % ITEM_PALETTE.length];
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
