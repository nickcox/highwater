import { chooseSession } from './lib/testing/session-picker';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { toWireAnalysis } from './lib/testing/wire-analysis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { defaultPresentationPreferences } from './lib/state/presentation-preferences';
import * as riverLayout from './lib/context-river/layout';
import { testAnalysis } from './lib/context-river/test-data';
import { liveAppendReplacementScenario, sessionScenario } from './lib/testing/session-scenarios';

let modifyAnalysis: ((analysis: ReturnType<typeof testAnalysis>) => void) | null = null;
let restoreViewportMeasurements = () => {};
let restoreScrollIntoView = () => {};

class TestEventSource {
  static instance: TestEventSource;
  readonly readyState = 1;
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(_url: string) {
    TestEventSource.instance = this;
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: string): void {
    const event = new MessageEvent(type, { data });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

afterEach(() => {
  cleanup();
  restoreScrollIntoView();
  restoreScrollIntoView = () => {};
  restoreViewportMeasurements();
  restoreViewportMeasurements = () => {};
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  modifyAnalysis = null;
  TestEventSource.instance = undefined as unknown as TestEventSource;
  vi.stubGlobal('EventSource', TestEventSource);
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  restoreScrollIntoView = () => {
    if (scrollIntoView)
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  };
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains('river-scroll') ? 960 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      const element = this as HTMLElement;
      return element.classList.contains('river-scroll')
        ? Math.max(960, Number(element.querySelector('svg')?.getAttribute('width')) || 0)
        : 0;
    },
  });
  restoreViewportMeasurements = () => {
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
    else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    if (scrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidth);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  };
  Object.defineProperty(SVGSVGElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: SVGSVGElement) {
      const host = (this.closest('.river-scroll') ?? this.parentElement) as HTMLElement;
      const width = Number(this.getAttribute('width')) || 960;
      return {
        left: -host.scrollLeft,
        top: 0,
        width,
        height: 500,
        right: width - host.scrollLeft,
        bottom: 500,
        x: -host.scrollLeft,
        y: 0,
        toJSON: () => ({}),
      };
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/sessions') {
        return new Response(
          JSON.stringify({
            sessions: [
              {
                id: 'one',
                fileName: 'one.jsonl',
                displayName: 'one',
                workingDirectory: null,
                startedAt: null,
                byteSize: 1,
                modifiedAt: null,
              },
              {
                id: 'two',
                fileName: 'two.jsonl',
                displayName: 'two',
                workingDirectory: null,
                startedAt: null,
                byteSize: 1,
                modifiedAt: null,
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              etag: '"catalog-v0"',
              'X-TokenPlume-Server-Generation': '0123456789abcdef0123456789abcdef',
              'X-TokenPlume-Catalog-Revision': '0',
              'X-TokenPlume-Live-Updates': 'active',
            },
          },
        );
      }
      const analysis = testAnalysis();
      modifyAnalysis?.(analysis);
      analysis.session.id = url.includes('two') ? 'two' : 'one';
      return new Response(JSON.stringify(toWireAnalysis(analysis)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

async function renderLoaded() {
  const result = render(App);
  await screen.findByRole('application', { name: 'Context River' });
  return result;
}

async function expandLifespans(): Promise<void> {
  const disclosure = document.querySelector('.lifespan-disclosure') as HTMLDetailsElement | null;
  if (disclosure && !disclosure.open) {
    await fireEvent.click(disclosure.querySelector('summary')!);
    await waitFor(() => expect(disclosure.querySelector('.lifespan-content')).not.toBeNull());
  }
}

function economicsTrackButton(name: string): HTMLButtonElement {
  const group = screen.getByRole('group', { name: 'Economics track' });
  const button = [...group.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (!button) throw new Error(`Economics track button not found: ${name}`);
  return button;
}

function emptyAnalysisResponse(id: string, etag: string): Response {
  const analysis = testAnalysis();
  analysis.session.id = id;
  analysis.modelCalls = [];
  analysis.contextItems = [];
  analysis.compactions = [];
  analysis.lineage = [];
  return new Response(JSON.stringify(toWireAnalysis(analysis)), {
    status: 200,
    headers: { 'content-type': 'application/json', etag },
  });
}

function withCacheEconomics(analysis: ReturnType<typeof testAnalysis>): void {
  const calls = analysis.modelCalls;
  for (const call of calls) {
    call.provider = 'anthropic';
    call.api = 'anthropic-messages';
    call.usage = { ...call.usage, input: 90, cacheRead: 10, cacheWrite: 0 };
    call.cost = { input: 0.01, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 };
    call.economics = {
      ...call.economics,
      policyId: 'anthropic-messages-cache-v1',
      usageCompleteness: 'complete',
      costCompleteness: 'complete',
      cacheWriteStatus: 'reported',
      promptTokens: 100,
      cacheReadRatio: 0.1,
      cacheWriteRatio: 0,
      freshRatio: 0.9,
      piPromptCost: 0.01,
      cacheRatioDiscontinuity: null,
      explanationCodes: [],
    };
  }
  analysis.economics = {
    ...analysis.economics,
    supportedPolicyIds: ['anthropic-messages-cache-v1'],
    usageCompleteness: { complete: calls.length, partial: 0, missing: 0, unsupported: 0 },
    costCompleteness: { complete: calls.length, partial: 0, missing: 0, unsupported: 0 },
    cacheReadEligibleCalls: calls.length,
    cacheReadPromptTokens: calls.length * 100,
    cacheReadTokens: calls.length * 10,
    cacheReadRatio: 0.1,
    explanationCodes: [],
  };
}

function analysisResponse(id: string, etag: string, model = 'm'): Response {
  const analysis = testAnalysis();
  analysis.session.id = id;
  analysis.modelCalls[0].model = model;
  return new Response(JSON.stringify(toWireAnalysis(analysis)), {
    status: 200,
    headers: { 'content-type': 'application/json', etag },
  });
}

function sessionListResponse(
  ids = ['one', 'two'],
  generation = '0123456789abcdef0123456789abcdef',
  revision = 0,
): Response {
  return new Response(
    JSON.stringify({
      sessions: ids.map((id) => ({
        id,
        fileName: `${id}.jsonl`,
        displayName: id,
        workingDirectory: null,
        startedAt: null,
        byteSize: 1,
        modifiedAt: null,
      })),
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        etag: `"catalog-v${revision}"`,
        'X-TokenPlume-Server-Generation': generation,
        'X-TokenPlume-Catalog-Revision': String(revision),
        'X-TokenPlume-Live-Updates': 'active',
      },
    },
  );
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('view links', () => {
  it('uses the stored grouping when a link has no display parameter', async () => {
    const preferences = defaultPresentationPreferences();
    preferences.river.display = 'itemTypes';
    localStorage.setItem('tokenplume.presentation.v1', JSON.stringify(preferences));
    const writes = vi.spyOn(localStorage, 'setItem');
    window.history.replaceState(null, '', '/#session=one');
    await renderLoaded();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Item types' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(writes).not.toHaveBeenCalled();
  });

  it('restores explicit Items over stored Item types without rewriting the preference', async () => {
    const preferences = defaultPresentationPreferences();
    preferences.river.display = 'itemTypes';
    localStorage.setItem('tokenplume.presentation.v1', JSON.stringify(preferences));
    const writes = vi.spyOn(localStorage, 'setItem');
    window.history.replaceState(null, '', '/#session=one&display=items');
    await renderLoaded();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Items' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(writes).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('tokenplume.presentation.v1')!).river.display).toBe(
      'itemTypes',
    );
    // A later history target with no display uses storage, not the transient URL override.
    window.history.pushState(null, '', '/#session=one');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Item types' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(writes).not.toHaveBeenCalled();
  });

  it('restores explicit Item types grouping without rewriting stored defaults', async () => {
    window.history.replaceState(null, '', '/#session=one&display=itemTypes');
    const writes = vi.spyOn(localStorage, 'setItem');
    await renderLoaded();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Item types' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(writes).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.hash.slice(1)).get('display')).toBe('itemTypes');
  });
  it('restores a Composition link, scope, pin and an item absent at the pinned call without clearing it', async () => {
    window.history.replaceState(
      null,
      '',
      '/#session=two&view=composition&scope=atCall&pin=3&item=a&range=2:4',
    );
    render(App);
    await screen.findByText('Pinned call 3', { exact: true });
    expect(screen.getByRole('tab', { name: 'Composition' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.hash.slice(1)).get('scope')).toBe('atCall');
    expect(new URLSearchParams(window.location.hash.slice(1)).get('range')).toBe('2:4');
  });

  it('restores the latest history target while an older linked session request is still pending', async () => {
    await renderLoaded();
    const fetcher = vi.mocked(fetch);
    const original = fetcher.getMockImplementation()!;
    let resolveTwo!: (response: Response) => void;
    const held = new Promise<Response>((resolve) => {
      resolveTwo = resolve;
    });
    fetcher.mockImplementation((input, init) =>
      String(input).includes('/two/') ? held : original(input, init),
    );
    window.history.pushState(null, '', '/#session=two&pin=3&item=a');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([input]) => String(input).includes('/two/'))).toBe(true),
    );
    window.history.pushState(null, '', '/#session=one&pin=2&item=summary');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await screen.findByText('Pinned call 2', { exact: true });
    const stale = testAnalysis();
    stale.session.id = 'two';
    resolveTwo(
      new Response(JSON.stringify(toWireAnalysis(stale)), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveAttribute(
      'data-session-id',
      'one',
    );
    expect(screen.getByText('Pinned call 2', { exact: true })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.hash.slice(1)).get('item')).toBe('summary');
  });

  it('can copy an empty-call session without inventing a viewport or pin', async () => {
    modifyAnalysis = (analysis) => Object.assign(analysis, sessionScenario('terminalSummaryOnly'));
    render(App);
    const button = await screen.findByRole('button', { name: 'Copy view link' });
    await waitFor(() => expect(button).toBeEnabled());
    await fireEvent.click(button);
    const input = await screen.findByRole('textbox', { name: 'View link' });
    const params = new URLSearchParams(new URL((input as HTMLInputElement).value).hash.slice(1));
    expect(params.get('session')).toBe('one');
    expect(params.has('range')).toBe(false);
    expect(params.has('pin')).toBe(false);
  });

  it('reports an unavailable session without applying its pin or item to the fallback session', async () => {
    window.history.replaceState(null, '', '/#session=gone&pin=3&item=a');
    render(App);
    await screen.findByRole('heading', { name: 'Context River' });
    expect(screen.getByRole('status', { name: 'View link status' })).toHaveTextContent(
      'not available here',
    );
    expect(screen.queryByRole('region', { name: 'Pinned call 3' })).not.toBeInTheDocument();
    expect(screen.queryByText('Selected item')).not.toBeInTheDocument();
  });

  it('offers a selectable manual copy fallback without copying query tokens when the clipboard is unavailable', async () => {
    window.history.replaceState(null, '', '/?token=private');
    render(App);
    const button = await screen.findByRole('button', { name: 'Copy view link' });
    await waitFor(() => expect(button).toBeEnabled());
    await fireEvent.click(button);
    const input = await screen.findByRole('textbox', { name: 'View link' });
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).value).toContain('#session=');
    expect((input as HTMLInputElement).value).not.toContain('private');
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByRole('status', { name: 'View link status' })).toHaveTextContent(
      'Clipboard access is unavailable',
    );
  });
});

describe('Context River interactions', () => {
  it('guards call shortcuts during editing, composition, modifier shortcuts and foreign focus', async () => {
    const { container } = await renderLoaded();
    const main = container.querySelector('main')!;
    await fireEvent.keyDown(document.body, { key: 'l' });
    expect(container.querySelector('#pinned-call-summary')).toBeNull();
    await fireEvent.keyDown(main, { key: 'ArrowRight' });
    expect(container.querySelector('#pinned-call-summary')).toHaveTextContent('Pinned call 1');
    for (const options of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { shiftKey: true },
      { isComposing: true },
    ]) {
      await fireEvent.keyDown(main, { key: 'l', ...options });
      expect(container.querySelector('#pinned-call-summary')).toHaveTextContent('Pinned call 1');
    }
    for (const tag of ['input', 'textarea', 'select']) {
      const editor = document.createElement(tag);
      main.append(editor);
      await fireEvent.keyDown(editor, { key: 'ArrowRight' });
      await fireEvent.keyDown(editor, { key: 'l' });
      expect(container.querySelector('#pinned-call-summary')).toHaveTextContent('Pinned call 1');
      editor.remove();
    }
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    editor.innerHTML = '<span>Editable text</span>';
    main.append(editor);
    await fireEvent.keyDown(editor.firstElementChild!, { key: 'l' });
    editor.remove();
    const foreign = document.createElement('button');
    document.body.append(foreign);
    try {
      await fireEvent.keyDown(foreign, { key: 'ArrowRight' });
    } finally {
      foreign.remove();
    }
    const handled = new KeyboardEvent('keydown', { key: 'l', bubbles: true, cancelable: true });
    handled.preventDefault();
    await fireEvent(main, handled);
    expect(container.querySelector('#pinned-call-summary')).toHaveTextContent('Pinned call 1');
    await fireEvent.keyDown(main, { key: 'l' });
    expect(container.querySelector('#pinned-call-summary')).toHaveTextContent('Pinned call 2');
  });
  it('does not invalidate River geometry for controller status-only publications', async () => {
    const geometry = vi.spyOn(riverLayout, 'layoutContextRiver');
    try {
      await renderLoaded();
      TestEventSource.instance.onopen?.(new Event('open'));
      await waitFor(() =>
        expect(screen.getByTestId('live-status')).toHaveTextContent(/^Live updates: live$/),
      );
      await waitFor(() =>
        expect(screen.queryByRole('status', { name: 'Refresh progress' })).toBeNull(),
      );
      const previousCalls = geometry.mock.calls.length;
      TestEventSource.instance.emit(
        'liveStatus',
        JSON.stringify({
          generation: '0123456789abcdef0123456789abcdef',
          availability: 'degraded',
        }),
      );
      await waitFor(() =>
        expect(screen.getByTestId('live-status')).toHaveTextContent('live updates unavailable'),
      );
      expect(geometry).toHaveBeenCalledTimes(previousCalls);
    } finally {
      geometry.mockRestore();
    }
  });
  it('uses chart hover only for the crosshair and pins a call on click', async () => {
    await renderLoaded();
    const chart = screen.getByRole('application', { name: 'Context River' });
    chart.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300 }));
    expect(screen.queryByText(/^Pinned call \d+$/)).not.toBeInTheDocument();
    expect(screen.getByText('Select a call to inspect usage.')).toBeInTheDocument();
    await fireEvent.click(chart, { clientX: 300 });
    expect(await screen.findByText(/^Pinned call 2$/)).toBeInTheDocument();
    chart.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 700 }));
    expect(screen.getByText(/^Pinned call 2$/)).toBeInTheDocument();
  });

  it('shows concise empty inspectors and disables Clear selection until state exists', async () => {
    await renderLoaded();
    expect(screen.getByText('Select a call to inspect usage.')).toBeInTheDocument();
    expect(screen.getByText('Select an item to inspect its context.')).toBeInTheDocument();
    expect(document.querySelectorAll('#inspector > .panel')).toHaveLength(1);
    const clear = screen.getByRole('button', { name: 'Clear selected item and pinned call' });
    expect(clear).toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 1' }));
    expect(clear).toBeEnabled();
    expect(document.querySelectorAll('#inspector > .panel')).toHaveLength(1);
    await fireEvent.click(clear);
    expect(clear).toBeDisabled();
    expect(document.querySelectorAll('#inspector > .panel')).toHaveLength(1);

    await expandLifespans();
    const itemRow = screen.getByLabelText(/bash: npm test; Tool result/);
    await fireEvent.click(itemRow.querySelector('.segment')!);
    expect(screen.getByRole('heading', { name: 'Context item' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Model call' })).not.toBeInTheDocument();
    expect(screen.getByText('Select a call to inspect usage.')).toBeInTheDocument();
    expect(document.querySelectorAll('#inspector > .panel')).toHaveLength(1);
  });

  it('opens chart help and closes it on Escape', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 1' }));
    const trigger = screen.getByRole('button', { name: 'Chart help' });
    await fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Chart help' })).toBeVisible();
    expect(screen.getByText(/modifier-wheel zoom/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Token-turns count an item's estimated tokens/),
    ).not.toBeInTheDocument();

    await fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(container.querySelector('.call-details')).toHaveTextContent('Pinned call 1');
  });

  it('shows a styled context-item inspector on hover without changing the persistent panel', async () => {
    await renderLoaded();
    const ribbon = screen.getByRole('button', { name: 'bash: npm test' });
    await fireEvent.pointerEnter(ribbon);
    expect(screen.getByRole('region', { name: 'Context item bash: npm test' })).toBeInTheDocument();
    expect(screen.getByText('Select an item to inspect its context.')).toBeInTheDocument();
  });

  it('expands a bounded context preview from the item inspector', async () => {
    modifyAnalysis = (analysis) => {
      analysis.contextItems[0].preview = {
        text: 'first line',
        kind: 'text',
        truncated: true,
        expandedText: 'first line\n<img src=x onerror=alert(1)>',
        expandedTruncated: false,
      };
    };
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    expect(
      screen.getByText('bash: npm test', { selector: '.item-details h3' }),
    ).toBeInTheDocument();
    expect(screen.getByText('first line', { selector: '.content-preview' })).toBeInTheDocument();
    expect(container.querySelector('.preview-details details')).toBeNull();
    const outer = container.querySelector('.preview-details')!.closest('details')!;
    outer.open = true;
    await fireEvent(outer, new Event('toggle'));
    await fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(container.querySelector('.preview-details pre')?.textContent).toBe(
      'first line\n<img src=x onerror=alert(1)>',
    );
    expect(container.querySelector('.preview-details img')).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(container.querySelector('.preview-details pre')).toBeNull();
    expect(screen.getByText('first line', { selector: '.content-preview' })).toBeInTheDocument();
  });

  it('renders concise tool labels in the pinned call panel', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 1' }));
    expect(screen.getByText('Tools invoked after this response')).toBeInTheDocument();
    expect(document.querySelector('.tool-chip')).toHaveTextContent('bash');
    expect(screen.queryByText('Dropped items (0)')).not.toBeInTheDocument();
    expect(screen.getByText('Technical identifiers')).toBeInTheDocument();
  });

  it('keeps call and item inspectors compact until diagnostic disclosures are opened', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 1' }));

    const callDetails = container.querySelector('.call-details')!;
    expect(callDetails.querySelectorAll('.essential-metrics > div')).toHaveLength(6);
    expect(callDetails.textContent).toContain('Context changes · 2 added / 0 retained / 0 dropped');
    expect(
      callDetails.querySelector('.usage-breakdown')?.querySelector('summary'),
    ).toHaveTextContent('Usage and economics');
    expect((callDetails.querySelector('.usage-breakdown') as HTMLDetailsElement).open).toBe(false);
    expect((callDetails.querySelector('.technical-identifiers') as HTMLDetailsElement).open).toBe(
      false,
    );

    await fireEvent.click(callDetails.querySelector('.usage-breakdown summary')!);
    expect(callDetails.querySelector('.usage-breakdown')).toHaveTextContent(
      'Input (raw normalized bucket)',
    );
    await fireEvent.click(
      screen.getByText('Token estimates', { selector: '.call-details summary' }),
    );
    // It applies to every call, so the estimate-quality note gives it once instead.
    expect(callDetails.querySelector('.token-diagnostics')).not.toHaveTextContent(
      'Provider usage is incomplete',
    );
    expect(container.querySelector('#estimate-quality-note')).toHaveTextContent(
      'Provider usage is incomplete',
    );

    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    const itemDetails = container.querySelector('.item-details')!;
    expect(itemDetails.querySelectorAll('.essential-metrics > div')).toHaveLength(3);
    expect(
      within(itemDetails as HTMLElement).getByText('Estimate basis & coverage', { exact: true }),
    ).toBeInTheDocument();
    expect((itemDetails.querySelector('.technical-identifiers') as HTMLDetailsElement).open).toBe(
      false,
    );
    expect(itemDetails.querySelector('.item-diagnostics')).toHaveTextContent('Profile estimates');
  });

  it('highlights only the selected ribbon and its direct compaction successor', async () => {
    const { container } = await renderLoaded();
    await expandLifespans();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Context lifespans · 4 items' }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.ribbon-group.selected')).toHaveLength(1);
    expect(container.querySelector('.ribbon-group.related, .ribbon-group.dimmed')).toBeNull();
    expect(container.querySelector('.lifespan-panel .row.dimmed')).toBeNull();
    expect(container.querySelectorAll('.lineage-connector.visible')).toHaveLength(1);
  });

  it('does not highlight a compaction summary’s sibling sources as one selection group', async () => {
    const { container } = await renderLoaded();
    await expandLifespans();
    await fireEvent.click(screen.getByRole('button', { name: 'Compaction summary' }));

    expect(container.querySelectorAll('.ribbon-group.selected')).toHaveLength(1);
    expect(container.querySelector('.ribbon-group.related, .ribbon-group.dimmed')).toBeNull();
    expect(container.querySelector('.lifespan-panel .row.dimmed')).toBeNull();
    expect(container.querySelectorAll('.lineage-connector.visible')).toHaveLength(0);
    expect(container.querySelector('.lifespan-panel .row.selected')).toHaveTextContent(
      'Compaction summary',
    );
  });

  it('resets lifespan filters and collapses browsing on an explicit session switch', async () => {
    await renderLoaded();
    await expandLifespans();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'bash' },
    });
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();

    await chooseSession('two');
    await waitFor(() =>
      expect((document.querySelector('.lifespan-disclosure') as HTMLDetailsElement).open).toBe(
        false,
      ),
    );
    await expandLifespans();
    expect(screen.getByRole('searchbox', { name: 'Search items' })).toHaveValue('');
    expect(
      screen.getByRole('heading', { name: 'Context lifespans · 4 items' }),
    ).toBeInTheDocument();
  });

  it('keeps presentation state independent between two mounted Apps and writes only explicit settings', async () => {
    const first = await renderLoaded();
    const second = render(App);
    await within(second.container).findByRole('application', { name: 'Context River' });
    expect(localStorage.getItem('tokenplume.presentation.v1')).toBeNull();
    expect(within(first.container).queryByRole('group', { name: 'River layout' })).toBeNull();
    await fireEvent.click(within(first.container).getByRole('button', { name: 'Visible calls' }));
    expect(within(first.container).getByRole('button', { name: 'Visible calls' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(second.container).getByRole('button', { name: 'Visible calls' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      JSON.parse(localStorage.getItem('tokenplume.presentation.v1')!).river.verticalScale,
    ).toBe('visible');
    expect(
      JSON.parse(localStorage.getItem('tokenplume.presentation.v1')!).river,
    ).not.toHaveProperty('layout');
    expect(
      within(first.container).queryByRole('button', { name: 'Reset view preferences' }),
    ).toBeNull();
    await fireEvent.click(within(first.container).getByRole('button', { name: 'Session scale' }));
    expect(within(first.container).getByRole('button', { name: 'Session scale' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('starts economics closed and preserves explicit preferences when switching sessions', async () => {
    modifyAnalysis = withCacheEconomics;
    await renderLoaded();
    expect(document.querySelector('.economics-track-svg')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Cache & cost' }));
    expect(economicsTrackButton('Cache')).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(economicsTrackButton('Cost'));
    expect(economicsTrackButton('Cost')).toHaveAttribute('aria-pressed', 'true');

    await chooseSession('two');
    await waitFor(() =>
      expect(economicsTrackButton('Cost')).toHaveAttribute('aria-pressed', 'true'),
    );
  });

  it('selects the same item from a lifespan segment', async () => {
    await renderLoaded();
    await expandLifespans();
    await fireEvent.click(
      screen.getByRole('button', { name: /bash: npm test, calls 1 through 2/ }),
    );
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(
      screen.getByText('bash: npm test', { selector: '.item-details h3' }),
    ).toBeInTheDocument();
  });

  it('reveals a selected item from its actual presence without changing pin or zoom', async () => {
    const { container } = await renderLoaded();
    await expandLifespans();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    const gapRow = [...container.querySelectorAll('.lifespan-panel .row')].find((row) =>
      row.textContent?.includes('<img src=x onerror=alert(1)>'),
    );
    expect(gapRow).toBeTruthy();
    await fireEvent.click(gapRow!.querySelector('.segment')!);
    expect(container.querySelector('.selection-location-note')).toBeNull();
    expect(screen.getByText(/not present at pinned call 2/)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(container.querySelector('.selection-location-note')).not.toBeNull());
    const widthAtZoom = container.querySelector('.river-scroll svg')?.getAttribute('width');

    await fireEvent.click(
      within(container.querySelector('.item-details') as HTMLElement).getByRole('button', {
        name: 'Reveal in River',
      }),
    );
    await waitFor(() => expect(container.querySelector('.selection-location-note')).toBeNull());
    expect(container.querySelector('.river-scroll')?.scrollLeft).toBe(0);
    expect(container.querySelector('.river-scroll svg')?.getAttribute('width')).toBe(widthAtZoom);
    expect(screen.getByText('Pinned call 2')).toBeInTheDocument();
    expect(screen.getByText('Selected item')).toBeInTheDocument();
  });

  it('dismisses each inspector from its outer panel header without clearing the other', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    const itemClose = screen.getByRole('button', { name: 'Close context item' });
    const callClose = screen.getByRole('button', { name: 'Close pinned call' });
    expect(itemClose.closest('.panel-head')).toHaveTextContent('Context item');
    expect(callClose.closest('.panel-head')).toHaveTextContent('Model call');
    expect(container.querySelector('.item-identity button')).toBeNull();
    expect(container.querySelector('.call-details header button')).toBeNull();
    await fireEvent.click(itemClose);
    expect(container.querySelector('#selected-item-summary')).toBeNull();
    expect(container.querySelector('#pinned-call-summary')).toHaveTextContent('Pinned call 1');
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Close pinned call' }));
    expect(container.querySelector('#pinned-call-summary')).toBeNull();
    expect(container.querySelector('#selected-item-summary')).toHaveTextContent('bash: npm test');
  });

  it('empty-space click preserves item selection while pinning a call', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    await fireEvent.click(container.querySelector('.plot-background')!, { clientX: 300 });
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(screen.getByText(/^Pinned call 2$/)).toBeInTheDocument();
  });

  it('Reset clears selected item and pinned call', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    await fireEvent.click(
      screen.getByRole('button', { name: 'Clear selected item and pinned call' }),
    );
    expect(screen.queryByText('Selected item')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Pinned call 2$/)).not.toBeInTheDocument();
  });

  it('session changes clear stale interaction and restore Fit all', async () => {
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('river-scroll') ? 300 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        const host = this as HTMLElement;
        return host.classList.contains('river-scroll')
          ? Math.max(300, Number(host.querySelector('svg')?.getAttribute('width')) || 0)
          : 0;
      },
    });
    restoreViewportMeasurements = () => {
      if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
      if (scrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidth);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
    };

    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const oldHost = document.querySelector('.river-scroll') as HTMLDivElement;
    await waitFor(() => expect(oldHost.scrollLeft).toBeGreaterThan(0));
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(screen.getByText(/^Pinned call 2$/)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Fit all calls' }));
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Latest' }));
    await waitFor(() => expect(oldHost.scrollLeft).toBe(117));

    await chooseSession('two');
    await waitFor(() => expect(screen.queryByText('Selected item')).not.toBeInTheDocument());
    await waitFor(() => expect(document.querySelector('.river-scroll')).not.toBeNull());
    const newHost = document.querySelector('.river-scroll') as HTMLDivElement;
    expect(newHost).not.toBe(oldHost);
    expect(newHost.scrollLeft).toBe(0);
    expect(screen.getByRole('button', { name: 'Fit all calls' })).toBeDisabled();
    expect(screen.getByText('Zoom 1.0×')).toBeInTheDocument();
  });

  it('clears zoom and pending navigation if live analysis has no calls', async () => {
    let revision = 0;
    let analysisRequests = 0;
    vi.stubGlobal('EventSource', TestEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') {
          const response = sessionListResponse(['one']);
          response.headers.set('etag', `"catalog-v${revision}"`);
          response.headers.set('X-TokenPlume-Catalog-Revision', String(revision));
          return Promise.resolve(response);
        }
        analysisRequests += 1;
        if (analysisRequests === 1) return Promise.resolve(analysisResponse('one', '"one-v1"'));
        if (analysisRequests === 2)
          return Promise.resolve(emptyAnalysisResponse('one', '"one-empty"'));
        return Promise.resolve(analysisResponse('one', `"one-v${analysisRequests}"`));
      }),
    );
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('river-scroll') ? 300 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        const host = this as HTMLElement;
        return host.classList.contains('river-scroll')
          ? Math.max(300, Number(host.querySelector('svg')?.getAttribute('width')) || 0)
          : 0;
      },
    });
    restoreViewportMeasurements = () => {
      if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
      if (scrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidth);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
    };

    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: 'Fit all calls' })).toBeEnabled();

    revision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({
        generation: '0123456789abcdef0123456789abcdef',
        revision: '1',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'No model calls' })).toBeInTheDocument();

    revision = 2;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({
        generation: '0123456789abcdef0123456789abcdef',
        revision: '2',
      }),
    );
    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Fit all calls' })).toBeDisabled(),
    );
    expect((document.querySelector('.river-scroll') as HTMLDivElement).scrollLeft).toBe(0);
    expect(screen.getByText('Zoom 1.0×')).toBeInTheDocument();
  });

  it('renders transcript labels as text rather than HTML', async () => {
    const { container } = await renderLoaded();
    expect(screen.getAllByText('<img src=x onerror=alert(1)>').length).toBeGreaterThan(0);
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('supports keyboard item selection and staged Escape reset', async () => {
    await renderLoaded();
    const ribbon = screen.getByRole('button', { name: 'bash: npm test' });
    ribbon.focus();
    await fireEvent.keyDown(ribbon, { key: 'Enter' });
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Selected item')).not.toBeInTheDocument();
    expect(screen.getByText(/^Pinned call 1$/)).toBeInTheDocument();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/^Pinned call 1$/)).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: 'Fit all calls' })).toBeEnabled();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Fit all calls' })).toBeDisabled();
  });

  it('does not let a focused SVG Escape clear selection and pin together', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    const ribbon = screen.getByRole('button', { name: 'bash: npm test' });
    await fireEvent.click(ribbon);
    expect(screen.getByText(/^Pinned call 1$/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    ribbon.focus();

    await fireEvent.keyDown(ribbon, { key: 'Escape' });
    expect(screen.queryByText('Selected item')).not.toBeInTheDocument();
    expect(screen.getByText(/^Pinned call 2$/)).toBeInTheDocument();

    await fireEvent.keyDown(ribbon, { key: 'Escape' });
    expect(screen.queryByText(/^Pinned call 2$/)).not.toBeInTheDocument();
  });
});

describe('manual recovery', () => {
  it.each(['catalogue', 'analysis'])(
    'retries a blocking %s failure without switching sessions',
    async (failure) => {
      let failed = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const catalogue = String(input) === '/api/sessions';
          if (!failed && catalogue === (failure === 'catalogue')) {
            failed = true;
            throw new Error('temporary failure');
          }
          return catalogue ? sessionListResponse() : analysisResponse('one', '"recovered"');
        }),
      );
      render(App);
      const retry = await screen.findByRole('button', { name: 'Retry' });
      retry.focus();
      await fireEvent.click(retry);
      expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
      expect(screen.queryByText('temporary failure')).not.toBeInTheDocument();
    },
  );

  it('keeps cached analysis visible during repeated manual refresh and clears only its warning', async () => {
    const pending = deferred<Response>();
    let analysisRequests = 0;
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') return sessionListResponse();
        analysisRequests += 1;
        if (analysisRequests === 1) return analysisResponse('one', '"cached"', 'cached-model');
        if (analysisRequests === 2) throw new Error('refresh temporarily unavailable');
        active += 1;
        maxActive = Math.max(maxActive, active);
        try {
          return await pending.promise;
        } finally {
          active -= 1;
        }
      }),
    );
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText(/Refresh failed; showing cached analysis/);
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    await fireEvent.click(refresh);
    await fireEvent.click(refresh);
    await fireEvent.click(refresh);
    expect(screen.getByRole('application', { name: 'Context River' })).toBeInTheDocument();
    expect(screen.getByText(/cached-model/)).toBeInTheDocument();
    pending.resolve(analysisResponse('one', '"fresh"', 'fresh-model'));
    await screen.findByText(/fresh-model/);
    await waitFor(() =>
      expect(screen.queryByText(/Refresh failed; showing cached analysis/)).toBeNull(),
    );
    expect(maxActive).toBe(1);
  });

  it('refreshes an empty catalogue without an SSE event', async () => {
    let requests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) !== '/api/sessions') return analysisResponse('one', '"recovered"');
        requests += 1;
        if (requests > 1) return sessionListResponse();
        const response = sessionListResponse();
        return new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: response.headers,
        });
      }),
    );
    render(App);
    await screen.findByRole('heading', { name: 'No sessions discovered' });
    await fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
  });
});

describe('analysis cache freshness', () => {
  it('reconciles selection and a lost cumulative pin made while cached revalidation is pending', async () => {
    const pending = deferred<Response>();
    let oneRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') return sessionListResponse();
        if (!url.includes('/one/')) return analysisResponse('two', '"two"');
        oneRequests += 1;
        return oneRequests === 1 ? analysisResponse('one', '"one"') : pending.promise;
      }),
    );
    await renderLoaded();
    await chooseSession('two');
    await waitFor(() =>
      expect(screen.getByRole('application', { name: 'Context River' })).toBeInTheDocument(),
    );
    await chooseSession('one');
    await fireEvent.click(await screen.findByRole('button', { name: 'bash: npm test' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    await expandLifespans();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'no-matching-item' },
    });
    await fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Find in lifespans' }));
    expect(
      await screen.findByText('The selected item is hidden by current lifespan filters.'),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getAllByRole('button', { name: 'Reveal in River' })[0]);
    const replacement = JSON.parse(
      JSON.stringify(testAnalysis()).replace(/"a"/g, '"replacement-a"'),
    ) as ReturnType<typeof testAnalysis>;
    replacement.session.id = 'one';
    replacement.modelCalls[1].sourceRecordId = 'replacement-call-record';
    pending.resolve(
      new Response(JSON.stringify(toWireAnalysis(replacement)), {
        status: 200,
        headers: { 'content-type': 'application/json', etag: '"replaced"' },
      }),
    );
    await waitFor(() => expect(screen.queryByText('Selected item')).toBeNull());
    expect(
      screen.queryByText('The selected item is hidden by current lifespan filters.'),
    ).toBeNull();
    expect(screen.queryByRole('region', { name: 'Pinned call 2' })).toBeNull();
    await fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    expect(
      screen.getByText(
        'The pinned call is no longer available; cumulative scope now covers the whole session.',
      ),
    ).toBeInTheDocument();
  });
  it('shows cached A immediately and keeps it after a conditional 304', async () => {
    const refresh = deferred<Response>();
    let oneRequests = 0;
    let conditionalHeader: string | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
        if (url.includes('/one/')) {
          oneRequests += 1;
          if (oneRequests === 1) return Promise.resolve(analysisResponse('one', '"one-v1"'));
          conditionalHeader = new Headers(init?.headers).get('If-None-Match');
          return refresh.promise;
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"'));
      }),
    );
    await renderLoaded();
    await chooseSession('two');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Session' })).toHaveAttribute(
        'data-session-id',
        'two',
      ),
    );
    await chooseSession('one');

    expect(screen.getByRole('application', { name: 'Context River' })).toBeInTheDocument();
    expect(screen.queryByText('Analysing session…')).not.toBeInTheDocument();
    expect(conditionalHeader).toBe('"one-v1"');
    refresh.resolve(new Response(null, { status: 304, headers: { etag: '"one-v1"' } }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('replaces a cached analysis only after a changed response validates', async () => {
    const refresh = deferred<Response>();
    let oneRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
        if (url.includes('/one/')) {
          oneRequests += 1;
          return oneRequests === 1
            ? Promise.resolve(analysisResponse('one', '"one-v1"', 'old-model'))
            : refresh.promise;
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"'));
      }),
    );
    await renderLoaded();
    expect(screen.getByText(/old-model/)).toBeInTheDocument();
    await chooseSession('two');
    await chooseSession('one');
    expect(screen.getByText(/old-model/)).toBeInTheDocument();

    refresh.resolve(analysisResponse('one', '"one-v2"', 'new-model'));
    expect(await screen.findByText(/new-model/)).toBeInTheDocument();
  });

  it('retains cached content and warns when refreshed data is malformed', async () => {
    let oneRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
        if (url.includes('/one/')) {
          oneRequests += 1;
          if (oneRequests === 1)
            return Promise.resolve(analysisResponse('one', '"one-v1"', 'cached-model'));
          const malformed = testAnalysis();
          malformed.schemaVersion = 999;
          return Promise.resolve(
            new Response(JSON.stringify(toWireAnalysis(malformed)), { status: 200 }),
          );
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"'));
      }),
    );
    await renderLoaded();
    await chooseSession('two');
    await chooseSession('one');

    expect(await screen.findByRole('status', { name: 'Refresh warnings' })).toHaveTextContent(
      'Refresh failed; showing cached analysis',
    );
    expect(screen.getByText(/cached-model/)).toBeInTheDocument();
    expect(screen.queryByText('Could not render this session')).not.toBeInTheDocument();
  });

  it('uses a non-destructive warning when a cached refresh request fails', async () => {
    let oneRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
        if (url.includes('/one/')) {
          oneRequests += 1;
          return oneRequests === 1
            ? Promise.resolve(analysisResponse('one', '"one-v1"', 'cached-model'))
            : Promise.reject(new Error('network unavailable'));
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"'));
      }),
    );
    await renderLoaded();
    await chooseSession('two');
    await chooseSession('one');

    expect(await screen.findByRole('status', { name: 'Refresh warnings' })).toHaveTextContent(
      'network unavailable',
    );
    expect(screen.getByText(/cached-model/)).toBeInTheDocument();
    expect(screen.queryByText('Could not render this session')).not.toBeInTheDocument();
  });

  it('ignores a late refresh for another session', async () => {
    const lateRefresh = deferred<Response>();
    let oneRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
        if (url.includes('/one/')) {
          oneRequests += 1;
          if (oneRequests === 1)
            return Promise.resolve(analysisResponse('one', '"one-v1"', 'cached-one'));
          return lateRefresh.promise;
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"', 'selected-two'));
      }),
    );
    await renderLoaded();
    await chooseSession('two');
    await chooseSession('one');
    expect(screen.getByText(/cached-one/)).toBeInTheDocument();
    await chooseSession('two');
    lateRefresh.resolve(analysisResponse('one', '"one-v2"', 'late-one'));

    await waitFor(() => expect(screen.getByText(/selected-two/)).toBeInTheDocument());
    expect(screen.queryByText(/late-one/)).not.toBeInTheDocument();
  });

  it('evicts the least-recently-used indexed analysis', async () => {
    const counts = new Map<string, number>();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/sessions')
          return Promise.resolve(sessionListResponse(['one', 'two', 'three', 'four']));
        const id = ['one', 'two', 'three', 'four'].find((candidate) =>
          url.includes(`/${candidate}/`),
        )!;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        if (id === 'one' && counts.get(id) === 2) {
          expect(new Headers(init?.headers).get('If-None-Match')).toBeNull();
        }
        return Promise.resolve(analysisResponse(id, `"${id}-v1"`));
      }),
    );
    await renderLoaded();
    for (const id of ['two', 'three', 'four', 'one']) {
      await chooseSession(id);
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Session' })).toHaveAttribute(
          'data-session-id',
          id,
        ),
      );
    }
    await waitFor(() => expect(counts.get('one')).toBe(2));
  });
});

describe('selected analysis request lifecycle', () => {
  const generationA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const generationB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  it('revalidates after invalidation during the first uncached load', async () => {
    const initial = deferred<Response>();
    let catalogueRevision = 0;
    let catalogueRequests = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          catalogueRequests += 1;
          return Promise.resolve(sessionListResponse(['one'], generationA, catalogueRevision));
        }
        analysisRequests += 1;
        return analysisRequests === 1
          ? initial.promise
          : Promise.resolve(analysisResponse('one', '"one-latest"', 'latest-model'));
      }),
    );

    render(App);
    await waitFor(() => expect(analysisRequests).toBe(1));
    catalogueRevision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    await waitFor(() => expect(catalogueRequests).toBe(2));
    expect(analysisRequests).toBe(1);
    initial.resolve(analysisResponse('one', '"one-stale"', 'stale-model'));
    await waitFor(() => expect(analysisRequests).toBe(2));

    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
    expect(await screen.findByText(/latest-model/)).toBeInTheDocument();
    expect(screen.queryByText(/stale-model/)).not.toBeInTheDocument();
  });

  it('restarts an initial load after generation changes and ignores its late response', async () => {
    const initial = deferred<Response>();
    let generation = generationA;
    let catalogueRequests = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          catalogueRequests += 1;
          return Promise.resolve(sessionListResponse(['one'], generation, 0));
        }
        analysisRequests += 1;
        return analysisRequests === 1
          ? initial.promise
          : Promise.resolve(analysisResponse('one', '"generation-b"', 'generation-b-model'));
      }),
    );

    render(App);
    await waitFor(() => expect(analysisRequests).toBe(1));
    generation = generationB;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationB, revision: '0' }),
    );
    await waitFor(() => expect(catalogueRequests).toBe(2));
    await waitFor(() => expect(analysisRequests).toBe(2));
    initial.resolve(analysisResponse('one', '"generation-a"', 'generation-a-model'));

    expect(await screen.findByText(/generation-b-model/)).toBeInTheDocument();
    expect(screen.queryByText('Analysing session…')).not.toBeInTheDocument();
    expect(screen.queryByText(/generation-a-model/)).not.toBeInTheDocument();
  });

  it('coalesces rapid invalidations and applies the final authoritative revision', async () => {
    const initial = deferred<Response>();
    const firstRefresh = deferred<Response>();
    let catalogueRevision = 0;
    let catalogueRequests = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          catalogueRequests += 1;
          if (catalogueRequests === 1) {
            return Promise.resolve(sessionListResponse(['one'], generationA, catalogueRevision));
          }
          if (catalogueRequests === 2) return firstRefresh.promise;
          return Promise.resolve(sessionListResponse(['one'], generationA, catalogueRevision));
        }
        analysisRequests += 1;
        return analysisRequests === 1
          ? initial.promise
          : Promise.resolve(
              analysisResponse(
                'one',
                `"revision-${catalogueRevision}"`,
                `revision-${catalogueRevision}-model`,
              ),
            );
      }),
    );

    render(App);
    await waitFor(() => expect(analysisRequests).toBe(1));
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    await waitFor(() => expect(catalogueRequests).toBe(2));
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '2' }),
    );
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '3' }),
    );
    catalogueRevision = 3;
    firstRefresh.resolve(sessionListResponse(['one'], generationA, 2));
    await waitFor(() => expect(catalogueRequests).toBe(3));
    await waitFor(() => expect(catalogueRevision).toBe(3));
    await waitFor(() => expect(analysisRequests).toBe(1));
    initial.resolve(analysisResponse('one', '"stale"', 'stale-model'));

    expect(await screen.findByText(/revision-3-model/)).toBeInTheDocument();
    expect(analysisRequests).toBe(2);
  });

  it('does not let a pending load for a switched-away session publish or warn', async () => {
    const pendingOne = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
        if (url.includes('/one/analysis')) return pendingOne.promise;
        return Promise.resolve(analysisResponse('two', '"two-v1"', 'selected-two-model'));
      }),
    );

    render(App);
    await screen.findByLabelText('Session');
    await chooseSession('two');
    expect(await screen.findByText(/selected-two-model/)).toBeInTheDocument();
    pendingOne.resolve(
      new Response(JSON.stringify({ error: { message: 'old session failed' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(screen.queryByText(/old session failed/)).not.toBeInTheDocument();
    expect(screen.queryByText('Could not render this session')).not.toBeInTheDocument();
  });

  it('discards pending analysis when the selected session is removed', async () => {
    const pending = deferred<Response>();
    let catalogueRevision = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          return Promise.resolve(
            sessionListResponse(
              catalogueRevision === 0 ? ['one'] : [],
              generationA,
              catalogueRevision,
            ),
          );
        }
        analysisRequests += 1;
        return pending.promise;
      }),
    );

    render(App);
    await waitFor(() => expect(analysisRequests).toBe(1));
    catalogueRevision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Selected session is no longer available' }),
    ).toBeInTheDocument();
    pending.resolve(
      new Response(JSON.stringify({ error: { message: 'removed session failed' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(screen.queryByText(/removed session failed/)).not.toBeInTheDocument();
    expect(screen.queryByRole('application', { name: 'Context River' })).not.toBeInTheDocument();
  });

  it('serializes cached selection revalidation with an overlapping invalidation', async () => {
    const cachedRevalidation = deferred<Response>();
    let catalogueRevision = 0;
    let catalogueRequests = 0;
    let oneRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/sessions') {
          catalogueRequests += 1;
          return Promise.resolve(
            sessionListResponse(['one', 'two'], generationA, catalogueRevision),
          );
        }
        if (url.includes('/one/analysis')) {
          oneRequests += 1;
          if (oneRequests === 1)
            return Promise.resolve(analysisResponse('one', '"one-v1"', 'cached-model'));
          if (oneRequests === 2) return cachedRevalidation.promise;
          return Promise.resolve(analysisResponse('one', '"one-latest"', 'latest-model'));
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"', 'two-model'));
      }),
    );

    await renderLoaded();
    await chooseSession('two');
    await screen.findByText(/two-model/);
    await chooseSession('one');
    await waitFor(() => expect(oneRequests).toBe(2));
    catalogueRevision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    await waitFor(() => expect(catalogueRequests).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(oneRequests).toBe(2);
    cachedRevalidation.resolve(analysisResponse('one', '"one-stale"', 'stale-cached-revalidation'));
    await waitFor(() => expect(oneRequests).toBe(3));

    expect(await screen.findByText(/latest-model/)).toBeInTheDocument();
    expect(screen.queryByText(/stale-cached-revalidation/)).not.toBeInTheDocument();
  });

  it('recovers an initial analysis failure on a later authoritative invalidation', async () => {
    let catalogueRevision = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          return Promise.resolve(sessionListResponse(['one'], generationA, catalogueRevision));
        }
        analysisRequests += 1;
        return analysisRequests === 1
          ? Promise.resolve(
              new Response(JSON.stringify({ error: { message: 'first analysis failed' } }), {
                status: 500,
                headers: { 'content-type': 'application/json' },
              }),
            )
          : Promise.resolve(analysisResponse('one', '"recovered"', 'recovered-model'));
      }),
    );

    render(App);
    expect(
      await screen.findByRole('heading', { name: 'Could not render this session' }),
    ).toBeInTheDocument();
    catalogueRevision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );

    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
    expect(await screen.findByText(/recovered-model/)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Could not render this session' }),
    ).not.toBeInTheDocument();
  });

  it('disposes an unmounted app while its initial analysis is pending', async () => {
    const pendingAnalysis = deferred<Response>();
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions')
          return Promise.resolve(sessionListResponse(['one'], generationA));
        analysisRequests += 1;
        return pendingAnalysis.promise;
      }),
    );

    const view = render(App);
    await waitFor(() => expect(analysisRequests).toBe(1));
    view.unmount();
    expect(TestEventSource.instance.closed).toBe(true);
    pendingAnalysis.resolve(analysisResponse('one', '"late"', 'late-model'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(analysisRequests).toBe(1);
    expect(screen.queryByText(/late-model/)).not.toBeInTheDocument();
  });

  it('switches visualization tabs with shared pinned-call and item selection state', async () => {
    await renderLoaded();
    const riverTab = screen.getByRole('tab', { name: 'River' });
    await fireEvent.keyDown(riverTab, { key: 'ArrowRight' });
    const compositionTab = screen.getByRole('tab', { name: 'Composition' });
    expect(compositionTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(compositionTab);
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Whole session' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspect latest call' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'At call' }));
    expect(screen.getByText(/Pin a call to inspect its item estimates/)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Inspect latest call' }));
    expect(
      screen.getByRole('heading', { name: 'Context composition · Call 4' }),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await fireEvent.pointerUp(document.querySelector('[data-composition-item="summary"]')!);
    expect(screen.getByRole('region', { name: 'Pinned call 4' })).toBeInTheDocument();
    expect(document.querySelector('.item-details h3')?.textContent).toBe('Compaction summary');

    await fireEvent.keyDown(compositionTab, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'River' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pinned call 4' })).toBeInTheDocument();
    expect(document.querySelector('.item-details h3')?.textContent).toBe('Compaction summary');
  });

  it('reveals a selected item absent from the pinned composition call in Context River', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    await fireEvent.click(screen.getByRole('button', { name: 'At call' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect latest call' }));
    await fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await fireEvent.pointerUp(document.querySelector('[data-composition-item="gap"]')!);
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect previous call' }));
    expect(screen.getByText(/not present at pinned call 3/)).toBeInTheDocument();

    await fireEvent.click(document.querySelector('.selected-composition-item button:last-child')!);
    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pinned call 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'River' })).toHaveAttribute('aria-selected', 'true');
  });

  it('resets Composition and its pinned call on an explicit session switch', async () => {
    await renderLoaded();
    await expandLifespans();
    await fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    await fireEvent.click(screen.getByRole('button', { name: 'At call' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Inspect latest call' }));
    expect(screen.getByRole('region', { name: 'Pinned call 4' })).toBeInTheDocument();

    await chooseSession('two');
    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'River' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('region', { name: 'Pinned call 4' })).toBeNull();
    expect(screen.getByText('Select a call to inspect usage.')).toBeInTheDocument();
    expect((document.querySelector('.lifespan-disclosure') as HTMLDetailsElement).open).toBe(false);
    await fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    expect(screen.getByRole('button', { name: 'Cumulative' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explains when a lost pin widens cumulative Composition to the whole session', async () => {
    const initial = testAnalysis();
    initial.session.id = 'one';
    const replacement = JSON.parse(JSON.stringify(initial)) as ReturnType<typeof testAnalysis>;
    replacement.modelCalls[1].sourceRecordId = 'replacement-call-record';
    let catalogueRevision = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          return Promise.resolve(sessionListResponse(['one'], generationA, catalogueRevision));
        }
        analysisRequests += 1;
        const analysis = analysisRequests === 1 ? initial : replacement;
        return Promise.resolve(
          new Response(JSON.stringify(toWireAnalysis(analysis)), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              etag: `"analysis-v${analysisRequests}"`,
            },
          }),
        );
      }),
    );

    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    expect(screen.getByRole('region', { name: 'Pinned call 2' })).toBeInTheDocument();

    catalogueRevision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pinned call 2' })).toBeNull());
    await fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Whole session' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The pinned call is no longer available; cumulative scope now covers the whole session.',
      ),
    ).toBeInTheDocument();
  });

  it('preserves the older Composition pin and selected item through same-session append', async () => {
    const { initial, replacement } = liveAppendReplacementScenario();
    initial.session.id = 'one';
    replacement.session.id = 'one';
    initial.modelCalls[3].model = 'model-1';
    replacement.modelCalls[3].model = 'model-2';
    let catalogueRevision = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          return Promise.resolve(sessionListResponse(['one'], generationA, catalogueRevision));
        }
        analysisRequests += 1;
        const analysis = analysisRequests === 1 ? initial : replacement;
        return Promise.resolve(
          new Response(JSON.stringify(toWireAnalysis(analysis)), {
            status: 200,
            headers: {
              'content-type': 'application/json',
              etag: `"analysis-v${analysisRequests}"`,
            },
          }),
        );
      }),
    );

    await renderLoaded();
    await expandLifespans();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 4' }));
    await fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    await fireEvent.click(screen.getByRole('button', { name: 'List' }));
    await fireEvent.pointerUp(document.querySelector('[data-composition-item="summary"]')!);
    expect(document.querySelector('.item-details h3')?.textContent).toBe('Compaction summary');

    catalogueRevision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Pinned call 4' })).toHaveTextContent('model-2'),
    );
    expect(screen.getByRole('region', { name: 'Session summary' })).toHaveTextContent('5');
    expect((document.querySelector('.lifespan-disclosure') as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByRole('tab', { name: 'Composition' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Calls 1–4' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.item-details h3')?.textContent).toBe('Compaction summary');
    expect(
      document.querySelector('.composition-list [data-composition-item="summary"]'),
    ).toHaveAttribute('aria-selected', 'true');

    await fireEvent.click(screen.getByRole('button', { name: 'Inspect next call' }));
    expect(
      screen.getByRole('heading', { name: 'Cumulative context usage · Calls 1–5' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.item-details h3')?.textContent).toBe('Compaction summary');
  });

  it('does not restart or publish a catalogue reconciliation after unmount', async () => {
    const pendingCatalogue = deferred<Response>();
    let catalogueRequests = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          catalogueRequests += 1;
          return catalogueRequests === 1
            ? Promise.resolve(sessionListResponse(['one'], generationA))
            : pendingCatalogue.promise;
        }
        analysisRequests += 1;
        return Promise.resolve(analysisResponse('one', '"one-v1"'));
      }),
    );

    const view = render(App);
    await screen.findByRole('application', { name: 'Context River' });
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    await waitFor(() => expect(catalogueRequests).toBe(2));
    view.unmount();
    pendingCatalogue.resolve(sessionListResponse(['one'], generationA, 1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(catalogueRequests).toBe(2);
    expect(analysisRequests).toBe(1);
  });

  it('discards queued refresh work after unmount', async () => {
    const pendingRefresh = deferred<Response>();
    let catalogueRevision = 0;
    let catalogueRequests = 0;
    let analysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          catalogueRequests += 1;
          return Promise.resolve(sessionListResponse(['one'], generationA, catalogueRevision));
        }
        analysisRequests += 1;
        return analysisRequests === 1
          ? Promise.resolve(analysisResponse('one', '"one-v1"'))
          : pendingRefresh.promise;
      }),
    );

    const view = render(App);
    await screen.findByRole('application', { name: 'Context River' });
    catalogueRevision = 1;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '1' }),
    );
    await waitFor(() => expect(analysisRequests).toBe(2));
    catalogueRevision = 2;
    TestEventSource.instance.emit(
      'sessionsChanged',
      JSON.stringify({ generation: generationA, revision: '2' }),
    );
    await waitFor(() => expect(catalogueRequests).toBe(3));
    view.unmount();
    pendingRefresh.resolve(analysisResponse('one', '"late-refresh"', 'late-refresh-model'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(analysisRequests).toBe(2);
    expect(catalogueRequests).toBe(3);
  });
});

describe('warning ownership', () => {
  const generation = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  it('keeps warnings independent and clears only the operation that recovers', async () => {
    let catalogueRequests = 0;
    let oneAnalysisRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/sessions') {
          catalogueRequests += 1;
          if (catalogueRequests === 2) return Promise.reject(new Error('catalogue unavailable'));
          return Promise.resolve(
            sessionListResponse(['one', 'two'], generation, catalogueRequests === 3 ? 1 : 0),
          );
        }
        const url = String(input);
        if (url.includes('/one/')) {
          oneAnalysisRequests += 1;
          return oneAnalysisRequests === 1
            ? Promise.resolve(analysisResponse('one', '"one-v1"', 'one-model'))
            : Promise.reject(new Error('analysis unavailable'));
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"', 'two-model'));
      }),
    );

    render(App);
    expect(await screen.findByText(/one-model/)).toBeInTheDocument();
    TestEventSource.instance.emit('sessionsChanged', JSON.stringify({ generation, revision: '1' }));
    expect(await screen.findByRole('status', { name: 'Refresh warnings' })).toHaveTextContent(
      'catalogue unavailable',
    );

    await chooseSession('two');
    expect(await screen.findByText(/two-model/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Refresh warnings' })).toHaveTextContent(
      'catalogue unavailable',
    );
    expect(screen.getByRole('status', { name: 'Refresh warnings' })).not.toHaveTextContent(
      'analysis unavailable',
    );

    await chooseSession('one');
    const warnings = await screen.findByRole('status', { name: 'Refresh warnings' });
    await waitFor(() => expect(warnings).toHaveTextContent('analysis unavailable'));
    expect(warnings).toHaveTextContent('catalogue unavailable');
    expect(await screen.findByRole('application', { name: 'Context River' })).toBeInTheDocument();

    TestEventSource.instance.emit('sessionsChanged', JSON.stringify({ generation, revision: '1' }));
    await waitFor(() => expect(catalogueRequests).toBe(3));
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Refresh warnings' })).not.toHaveTextContent(
        'catalogue unavailable',
      ),
    );
    expect(screen.getByRole('status', { name: 'Refresh warnings' })).toHaveTextContent(
      'analysis unavailable',
    );
    expect(screen.getByText(/one-model/)).toBeInTheDocument();
  });
});
