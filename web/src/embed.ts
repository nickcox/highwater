import { mount, unmount } from 'svelte';
import EmbeddedSession from './lib/embed/EmbeddedSession.svelte';
import { themeController } from './lib/theme/controller';
import { themeCss } from '../scripts/theme-html';
import workspaceCss from './lib/styles/workspace.css?inline';
import type { AnalysisLoader } from './lib/embed/analysis-controller';

export interface HighwaterEmbedOptions {
  target: HTMLElement;
  loadAnalysis: AnalysisLoader;
  preferencesKey: string;
  theme: 'light' | 'dark';
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
  `;
  const container = document.createElement('div');
  container.className = 'highwater-embed-root';
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
      props: { loadAnalysis: options.loadAnalysis, preferencesKey: options.preferencesKey },
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
