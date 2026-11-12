import type { Plugin } from 'vite';
import {
  palettes,
  paletteIds,
  THEME_KEY,
  parseThemePreference,
  type Palette,
} from '../src/lib/theme/palettes.js';

function declarations(palette: Palette): string {
  const tokens = Object.entries(palette.tokens).map(([name, value]) => `--${name}:${value};`);
  const types = Object.entries(palette.itemTypes).map(
    ([name, value]) => `--item-type-${name}:${value};`,
  );
  const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='${palette.tokens.secondary.replace('#', '%23')}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
  return `color-scheme:${palette.colorScheme};${tokens.join('')}${types.join('')}--chevron:${chevron};`;
}

export function themeCss(
  registry: readonly Palette[] = Object.values(palettes),
  selector: 'html' | ':host' = 'html',
): string {
  const root = selector === 'html' ? ':root' : ':host';
  const background = selector === 'html' ? 'html{background:var(--page)}' : '';
  const themed = (id: string) =>
    selector === 'html' ? `html[data-theme="${id}"]` : `:host([data-theme="${id}"])`;
  return `${root}{${declarations(palettes.dark)}}${background}${registry.map((palette) => `${themed(palette.id)}{${declarations(palette)}}`).join('')}`;
}

/** Generate a self-contained classic script without importing application code. */
export function themeBootstrap(): string {
  const config = JSON.stringify({ ids: paletteIds, key: THEME_KEY }).replace(/</g, '\\u003c');
  return `(()=>{const config=${config};const parse=${parseThemePreference.toString()};let raw=null;let dark=true;try{raw=window.localStorage.getItem(config.key)}catch{}try{dark=window.matchMedia('(prefers-color-scheme: dark)').matches}catch{}const preference=parse(raw,config.ids);document.documentElement.dataset.theme=preference==='system'?(dark?'dark':'light'):preference})()`;
}

export function themeHtml(): Plugin {
  return {
    name: 'highwater-theme-html',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/theme-bootstrap.js') return next();
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(themeBootstrap());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'theme-bootstrap.js', source: themeBootstrap() });
    },
    transformIndexHtml: {
      // Add the already-generated classic script after Vite's module processing. A module
      // would defer startup; an inline script would violate the embedded server's CSP.
      order: 'post',
      handler: (_html, context) =>
        context.path !== '/index.html'
          ? []
          : [
              {
                tag: 'style',
                attrs: { id: 'theme-palettes' },
                children: themeCss(),
                injectTo: 'head',
              },
              {
                tag: 'script',
                attrs: { id: 'theme-bootstrap', src: '/theme-bootstrap.js' },
                injectTo: 'head',
              },
            ],
    },
  };
}
