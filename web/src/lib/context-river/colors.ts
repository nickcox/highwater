export const ITEM_PALETTE = [
  '#79a8ff',
  '#58c7b6',
  '#f27f5b',
  '#ffb14e',
  '#c78bdd',
  '#e0c75a',
  '#4ca8e0',
  '#9aa9c4',
  '#e875b5',
  '#5ac58b',
] as const;

export const CHART_BACKGROUND = '#0c1324';

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
