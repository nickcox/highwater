/** Analysis payloads are validated by Highwater before they are indexed or rendered. */
export type AnalysisFetchResult =
  | { status: 'ok'; analysis: unknown; etag: string | null }
  | { status: 'notModified'; etag: string | null };
export interface HighwaterEmbedOptions {
  target: HTMLElement;
  loadAnalysis(signal: AbortSignal, etag: string | null): Promise<AnalysisFetchResult>;
  preferencesKey: string;
  theme: 'light' | 'dark';
}
export interface HighwaterEmbed {
  refresh(): void;
  setTheme(theme: 'light' | 'dark'): void;
  destroy(): void;
}
export function mountHighwater(options: HighwaterEmbedOptions): HighwaterEmbed;
