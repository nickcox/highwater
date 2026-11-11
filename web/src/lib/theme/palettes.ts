import type { ContextItemKind } from '../types.js';

export const ITEM_COLOR_SLOT_COUNT = 10;

const darkTokens = {
  page: '#11171c',
  surface: '#161e24',
  plot: '#131b21',
  text: '#e5edf0',
  secondary: '#a5b4be',
  separator: '#2b3942',
  'control-border': '#607581',
  accent: '#9cd8c5',
  action: '#253f39',
  warning: '#ffd28d',
  error: '#ffc0ae',
  'text-strong': '#f4f8f9',
  muted: '#8b9aa4',
  'surface-raised': '#1d272e',
  'selected-surface': '#22333a',
  'chart-guide': '#1e2a31',
  'warning-surface': '#2a2415',
  'warning-border': '#7d6840',
  'error-surface': '#2a1c1f',
  'error-border': '#7d493f',
  compaction: '#ffb14e',
  'compaction-text': '#ffca87',
  'active-text': '#ffffff',
  selection: '#ffffff',
  'selection-soft': '#ffffff8c',
  'selection-focus': '#ffffffbf',
  'swatch-border': '#ffffff73',
  'presence-overlay': '#ffffff2e',
  shadow: '#00000059',
  'shadow-strong': '#00000080',
  'input-gap': '#aab4c7',
  'input-gap-base': '#8793aa',
  'unknown-fill': '#46516a',
  'unknown-mark': '#8793aa',
  'cache-read': '#428fdc',
  'cache-write': '#9167c7',
  'cache-write-mark': '#e0c9ff',
  'cache-fresh': '#277d68',
  'cache-fresh-mark': '#b5f6df',
  'cache-nonread': '#626e87',
  'cache-nonread-mark': '#aab5c9',
  cost: '#7ddbb7',
  'api-cost': '#b9a8ff',
  'event-warning': '#ffbd64',
  'event-success': '#80dcba',
  'event-target': '#aad3ef',
  'event-compaction-fill': '#4b3821',
  'event-compaction-text': '#ffffff',
  'event-warning-text': '#11171c',
  'event-success-text': '#11171c',
  'lifespan-version': '#728fc5',
};

export type ThemeToken = keyof typeof darkTokens;
export interface Palette {
  readonly id: string;
  readonly label: string;
  readonly colorScheme: 'light' | 'dark';
  readonly tokens: Readonly<Record<ThemeToken, string>>;
  readonly itemTypes: Readonly<Record<ContextItemKind, string>>;
  readonly items: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
}

export const palettes = {
  dark: {
    id: 'dark',
    label: 'Dark',
    colorScheme: 'dark',
    tokens: darkTokens,
    itemTypes: {
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
    },
    items: [
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
    ],
  },
  light: {
    id: 'light',
    label: 'Light',
    colorScheme: 'light',
    tokens: {
      page: '#f1f5f6',
      surface: '#ffffff',
      plot: '#f8fafb',
      text: '#24343e',
      secondary: '#4b606d',
      separator: '#cbd5db',
      'control-border': '#788c97',
      accent: '#226953',
      action: '#d7eee5',
      warning: '#795000',
      error: '#a13727',
      'text-strong': '#132630',
      muted: '#576b77',
      'surface-raised': '#eaf0f3',
      'selected-surface': '#e1eee9',
      'chart-guide': '#e3eaee',
      'warning-surface': '#fff5df',
      'warning-border': '#9c7428',
      'error-surface': '#fff0ec',
      'error-border': '#af6252',
      compaction: '#9a5700',
      'compaction-text': '#855000',
      'active-text': '#153e30',
      selection: '#142c3c',
      'selection-soft': '#142c3cbf',
      'selection-focus': '#142c3c',
      'swatch-border': '#142c3c73',
      'presence-overlay': '#142c3c2e',
      shadow: '#183b4b26',
      'shadow-strong': '#183b4b38',
      'input-gap': '#586a82',
      'input-gap-base': '#61728a',
      'unknown-fill': '#d9dfeb',
      'unknown-mark': '#63738e',
      'cache-read': '#246db0',
      'cache-write': '#7850a9',
      'cache-write-mark': '#eadbff',
      'cache-fresh': '#236b58',
      'cache-fresh-mark': '#b5f6df',
      'cache-nonread': '#59657e',
      'cache-nonread-mark': '#d4ddeb',
      cost: '#216e50',
      'api-cost': '#7050ad',
      'event-warning': '#a35f00',
      'event-success': '#216e50',
      'event-target': '#316d9a',
      'event-compaction-fill': '#fff0d6',
      'event-compaction-text': '#704200',
      'event-warning-text': '#ffffff',
      'event-success-text': '#ffffff',
      'lifespan-version': '#436aa5',
    },
    itemTypes: {
      system: '#6c7f93',
      toolDefinition: '#cb643c',
      userMessage: '#3282d0',
      assistantMessage: '#11967d',
      toolResult: '#a57a05',
      compactionSummary: '#a865cc',
      customMessage: '#c45d97',
      branchSummary: '#82880a',
      thinking: '#168fa7',
      unrecordedContext: '#a27951',
      other: '#89816d',
    },
    items: [
      '#3783cf',
      '#159579',
      '#c5662e',
      '#a57a05',
      '#a865cc',
      '#82880a',
      '#168fa7',
      '#677ec0',
      '#c45d97',
      '#469331',
    ],
  },
} as const satisfies Record<string, Palette>;

export type PaletteId = keyof typeof palettes;
export type ThemePreference = 'system' | PaletteId;
export const paletteList: readonly Palette[] = Object.values(palettes);
export const paletteIds = paletteList.map((palette) => palette.id);
export const THEME_KEY = 'highwater.theme.v1';

/** Self-contained so the same validation runs in the blocking HTML bootstrap. */
export function parseThemePreference(raw: string | null, ids: readonly string[]): string {
  if (!raw || raw.length > 256) return 'system';
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'string' && (value === 'system' || ids.includes(value))
      ? value
      : 'system';
  } catch {
    return 'system';
  }
}

export function resolvePalette(preference: ThemePreference, systemDark: boolean): Palette {
  return palettes[preference === 'system' ? (systemDark ? 'dark' : 'light') : preference];
}
