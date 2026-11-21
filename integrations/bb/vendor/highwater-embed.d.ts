import type { ContextItemKind } from '../context-item-kinds';

/** Analysis payloads are validated by Highwater before they are indexed or rendered. */
export type AnalysisFetchResult =
  | { status: 'ok'; analysis: unknown; etag: string | null }
  | { status: 'notModified'; etag: string | null };
export type SectionId = 'summary' | 'call' | 'chart' | 'details' | 'lifespans';
/** Section orders for `sections`: `standard` matches the standalone viewer. */
export const sectionPresets: {
  standard: readonly SectionId[];
  panel: readonly SectionId[];
};
export function contextItemPresentation(
  kind: ContextItemKind,
  mode: 'light' | 'dark',
): { label: string; colour: string };
export interface HighwaterEmbedOptions {
  target: HTMLElement;
  loadAnalysis(signal: AbortSignal, etag: string | null): Promise<AnalysisFetchResult>;
  preferencesKey: string;
  theme: 'light' | 'dark';
  /** The River's vertical scale until the user chooses one; defaults to `session`. */
  defaultVerticalScale?: 'session' | 'visible';
  /** `compact` uses smaller text, controls and gaps, to sit inside a dense host such as bb. */
  density?: 'standard' | 'compact';
  /** The order of the view's sections, fixed for this mount; defaults to `sectionPresets.standard`.
   * With a `call` section, following the latest call also selects it. */
  sections?: readonly SectionId[];
}
export interface HighwaterEmbed {
  refresh(): void;
  setTheme(theme: 'light' | 'dark'): void;
  destroy(): void;
}
export function mountHighwater(options: HighwaterEmbedOptions): HighwaterEmbed;
