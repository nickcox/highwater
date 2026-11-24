import { mount, unmount } from 'svelte';
import EmbeddedSession from './lib/embed/EmbeddedSession.svelte';
import { themeController } from './lib/theme/controller';
import { themeCss } from '../scripts/theme-html';
import workspaceCss from './lib/styles/workspace.css?inline';
import type { AnalysisLoader } from './lib/embed/analysis-controller';
import type { ItemContentLoader } from './lib/api/client';
export type { ItemContentLoader } from './lib/api/client';
import { PANEL_SECTIONS, STANDARD_SECTIONS, type SectionId } from './lib/state/session-sections';
import { kindGroupLabel } from './lib/kind-labels';
import { palettes } from './lib/theme/palettes';
import type { ContextItemKind } from './lib/types';

export type { SectionId };
/** Section orders for `sections`: `standard` matches the standalone viewer. */
export const sectionPresets = { standard: STANDARD_SECTIONS, panel: PANEL_SECTIONS };

export function contextItemPresentation(kind: ContextItemKind, mode: 'light' | 'dark') {
  return { label: kindGroupLabel(kind), colour: palettes[mode].itemTypes[kind] };
}

export interface HighwaterEmbedOptions {
  target: HTMLElement;
  loadAnalysis: AnalysisLoader;
  loadItemContent?: ItemContentLoader;
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

const roots = new WeakMap<HTMLElement, ShadowRoot>();

export function mountHighwater(options: HighwaterEmbedOptions): HighwaterEmbed {
  const { target } = options;
  const root = roots.get(target) ?? target.attachShadow({ mode: 'open' });
  if (root.hasChildNodes()) throw new Error('Highwater is already mounted in this target');
  roots.set(target, root);
  const previousTheme = target.getAttribute('data-theme');
  const style = document.createElement('style');
  style.textContent =
    themeCss(undefined, ':host') +
    workspaceCss +
    `
    :host { display:block; background:var(--page); color:var(--text);
      font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif; }
    .highwater-embed-root { container-type:inline-size; container-name:highwater; min-width:0; }
    .highwater-embed-root.compact { font-size:13px; --control-padding:4px 8px; --control-size:24px;
      --toggle-height:24px; --toggle-padding:3px 8px; --panel-padding:12px; --panel-gap:10px; }
    .highwater-embed-root.compact :is(button:not(.step-call), select, input, summary) { font-size:12px; }
  `;
  const container = document.createElement('div');
  container.className =
    options.density === 'compact' ? 'highwater-embed-root compact' : 'highwater-embed-root';
  root.append(style, container);
  let destroyed = false;
  function setTheme(theme: 'light' | 'dark'): void {
    if (destroyed) return;
    target.dataset.theme = theme;
    themeController.setPalette(theme);
  }
  setTheme(options.theme);
  let component: { refresh(): void };
  try {
    component = mount(EmbeddedSession, {
      target: container,
      props: {
        loadAnalysis: options.loadAnalysis,
        loadItemContent: options.loadItemContent,
        preferencesKey: options.preferencesKey,
        sections: options.sections,
        defaultVerticalScale: options.defaultVerticalScale,
        density: options.density,
      },
    });
  } catch (error) {
    root.replaceChildren();
    if (previousTheme === null) target.removeAttribute('data-theme');
    else target.setAttribute('data-theme', previousTheme);
    throw error;
  }
  return {
    refresh: () => {
      if (!destroyed) component.refresh();
    },
    setTheme,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      void unmount(component);
      root.replaceChildren();
      if (previousTheme === null) target.removeAttribute('data-theme');
      else target.setAttribute('data-theme', previousTheme);
    },
  };
}
