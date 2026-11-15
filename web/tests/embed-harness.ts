import type {
  HighwaterEmbed,
  HighwaterEmbedOptions,
  SectionId,
} from '../../integrations/bb/vendor/highwater-embed';
import type { WireSessionAnalysis } from '../src/lib/types';

export interface EmbedHarness {
  replace(analysis: WireSessionAnalysis): void;
  setTheme(theme: 'light' | 'dark'): void;
  fail(): void;
  recover(): void;
  mountSecond(): void;
  destroy(): void;
  requests(): number;
}
declare global {
  interface Window {
    highwaterPayload: WireSessionAnalysis;
    /** Optional section order for the first view. */
    highwaterSections?: SectionId[];
    /** Optional density for the first view. */
    highwaterDensity?: 'standard' | 'compact';
    /** Optional starting vertical scale for the first view. */
    highwaterVerticalScale?: 'session' | 'visible';
    highwaterHarness: EmbedHarness;
  }
}
const modulePath = '/embed-module.js';
const { mountHighwater } = (await import(/* @vite-ignore */ modulePath)) as {
  mountHighwater(options: HighwaterEmbedOptions): HighwaterEmbed;
};
let analysis = window.highwaterPayload;
let version = 1;
let failed = false;
let requests = 0;
let second: HighwaterEmbed | undefined;
let theme: 'light' | 'dark' = 'light';
const loadAnalysis: HighwaterEmbedOptions['loadAnalysis'] = async (_signal, etag) => {
  requests += 1;
  if (failed) throw new Error('Test analysis is unavailable');
  const nextEtag = `v${version}`;
  return etag === nextEtag
    ? { status: 'notModified', etag }
    : { status: 'ok', etag: nextEtag, analysis };
};
const view = mountHighwater({
  target: document.getElementById('embed')!,
  theme,
  preferencesKey: 'test.highwater.presentation',
  loadAnalysis,
  sections: window.highwaterSections,
  density: window.highwaterDensity,
  defaultVerticalScale: window.highwaterVerticalScale,
});
window.highwaterHarness = {
  replace(next) {
    analysis = next;
    version += 1;
    view.refresh();
  },
  setTheme(next) {
    theme = next;
    view.setTheme(next);
    second?.setTheme(next);
  },
  fail() {
    failed = true;
    view.refresh();
  },
  recover() {
    failed = false;
    view.refresh();
  },
  mountSecond() {
    second = mountHighwater({
      target: document.getElementById('second-embed')!,
      theme,
      preferencesKey: 'test.highwater.second',
      loadAnalysis,
    });
  },
  destroy() {
    view.destroy();
    second?.destroy();
  },
  requests: () => requests,
};
