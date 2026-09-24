import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { testAnalysis } from './lib/context-river/test-data';

let modifyAnalysis: ((analysis: ReturnType<typeof testAnalysis>) => void) | null = null;
let restoreViewportMeasurements = () => {};

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
  restoreViewportMeasurements();
  restoreViewportMeasurements = () => {};
  vi.unstubAllGlobals();
});

beforeEach(() => {
  modifyAnalysis = null;
  TestEventSource.instance = undefined as unknown as TestEventSource;
  vi.stubGlobal('EventSource', TestEventSource);
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
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
      const host = this.parentElement as HTMLElement;
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
      return new Response(JSON.stringify(analysis), {
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

function emptyAnalysisResponse(id: string, etag: string): Response {
  const analysis = testAnalysis();
  analysis.session.id = id;
  analysis.modelCalls = [];
  analysis.contextItems = [];
  analysis.compactions = [];
  analysis.lineage = [];
  return new Response(JSON.stringify(analysis), {
    status: 200,
    headers: { 'content-type': 'application/json', etag },
  });
}

function analysisResponse(id: string, etag: string, model = 'm'): Response {
  const analysis = testAnalysis();
  analysis.session.id = id;
  analysis.modelCalls[0].model = model;
  return new Response(JSON.stringify(analysis), {
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

describe('Context River interactions', () => {
  it('uses chart hover only for the crosshair and pins a call on click', async () => {
    await renderLoaded();
    const chart = screen.getByRole('application', { name: 'Context River' });
    chart.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300 }));
    expect(screen.queryByText(/Pinned call/)).not.toBeInTheDocument();
    expect(screen.getByText('No call pinned.')).toBeInTheDocument();
    await fireEvent.click(chart, { clientX: 300 });
    expect(await screen.findByText('Pinned call', { exact: false })).toBeInTheDocument();
    chart.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 700 }));
    expect(screen.getByText('Pinned call', { exact: false })).toHaveTextContent('Pinned call 2');
  });

  it('shows a styled context-item inspector on hover without changing the persistent panel', async () => {
    await renderLoaded();
    const ribbon = screen.getByRole('button', { name: 'bash: npm test' });
    await fireEvent.pointerEnter(ribbon);
    expect(screen.getByRole('region', { name: 'Context item bash: npm test' })).toBeInTheDocument();
    expect(screen.getByText('No context item selected')).toBeInTheDocument();
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
    const details = container.querySelector('.preview-details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    details.open = true;
    expect(container.querySelector('.preview-details pre')?.textContent).toBe(
      'first line\n<img src=x onerror=alert(1)>',
    );
    expect(container.querySelector('.preview-details img')).not.toBeInTheDocument();
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
    expect(
      callDetails.querySelector('.usage-breakdown')?.querySelector('summary'),
    ).toHaveTextContent('Usage breakdown');
    expect((callDetails.querySelector('.usage-breakdown') as HTMLDetailsElement).open).toBe(false);
    expect((callDetails.querySelector('.technical-identifiers') as HTMLDetailsElement).open).toBe(
      false,
    );

    await fireEvent.click(callDetails.querySelector('.usage-breakdown summary')!);
    expect(callDetails.querySelector('.usage-breakdown')).toHaveTextContent('Fresh input');
    await fireEvent.click(
      screen.getByText('Token estimates and diagnostics', { selector: '.call-details summary' }),
    );
    expect(callDetails.querySelector('.token-diagnostics')).toHaveTextContent(
      'Provider usage is incomplete',
    );

    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    const itemDetails = container.querySelector('.item-details')!;
    expect(itemDetails.querySelectorAll('.essential-metrics > div')).toHaveLength(4);
    expect((itemDetails.querySelector('.technical-identifiers') as HTMLDetailsElement).open).toBe(
      false,
    );
    expect(itemDetails.querySelector('.item-diagnostics')).toHaveTextContent('Profile estimates');
  });

  it('highlights only the selected ribbon and its direct compaction successor', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(screen.getByText('4 of 4 items')).toBeInTheDocument();
    expect(container.querySelectorAll('.ribbon-group.selected')).toHaveLength(1);
    expect(container.querySelector('.ribbon-group.related, .ribbon-group.dimmed')).toBeNull();
    expect(container.querySelector('.lifespan-panel .row.dimmed')).toBeNull();
    expect(container.querySelectorAll('.lineage-connector.visible')).toHaveLength(1);
  });

  it('does not highlight a compaction summary’s sibling sources as one selection group', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Compaction summary' }));

    expect(container.querySelectorAll('.ribbon-group.selected')).toHaveLength(1);
    expect(container.querySelector('.ribbon-group.related, .ribbon-group.dimmed')).toBeNull();
    expect(container.querySelector('.lifespan-panel .row.dimmed')).toBeNull();
    expect(container.querySelectorAll('.lineage-connector.visible')).toHaveLength(0);
    expect(container.querySelector('.lifespan-panel .row.selected')).toHaveTextContent(
      'Compaction summary',
    );
  });

  it('resets lifespan filters on an explicit session switch', async () => {
    await renderLoaded();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'bash' },
    });
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();

    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Search items' })).toHaveValue(''),
    );
    expect(screen.getByText('4 of 4 items')).toBeInTheDocument();
  });

  it('selects the same item from a lifespan segment', async () => {
    await renderLoaded();
    await fireEvent.click(
      screen.getByRole('button', { name: /bash: npm test, calls 1 through 2/ }),
    );
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    expect(
      screen.getByText('bash: npm test', { selector: '.item-details h3' }),
    ).toBeInTheDocument();
  });

  it('empty-space click clears item selection while pinning a call', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    await fireEvent.click(container.querySelector('.plot-background')!, { clientX: 300 });
    expect(screen.queryByText('Selected item')).not.toBeInTheDocument();
    expect(screen.getByText('Pinned call', { exact: false })).toBeInTheDocument();
  });

  it('Reset clears selected item and pinned call', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'bash: npm test' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    await fireEvent.click(
      screen.getByRole('button', { name: 'Clear selected item and pinned call' }),
    );
    expect(screen.queryByText('Selected item')).not.toBeInTheDocument();
    expect(screen.queryByText('Pinned call', { exact: false })).not.toBeInTheDocument();
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
    expect(screen.getByText('Pinned call', { exact: false })).toHaveTextContent('Pinned call 2');

    await fireEvent.click(screen.getByRole('button', { name: 'Fit all calls' }));
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(screen.getByText('Selected item')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Latest' }));
    await waitFor(() => expect(oldHost.scrollLeft).toBe(117));

    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
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
    ribbon.focus();

    await fireEvent.keyDown(ribbon, { key: 'Escape' });
    expect(screen.queryByText('Selected item')).not.toBeInTheDocument();
    expect(screen.getByText('Pinned call', { exact: false })).toHaveTextContent('Pinned call 2');

    await fireEvent.keyDown(ribbon, { key: 'Escape' });
    expect(screen.queryByText('Pinned call', { exact: false })).not.toBeInTheDocument();
  });
});

describe('analysis cache freshness', () => {
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
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await waitFor(() => expect(screen.getByLabelText('Session')).toHaveValue('two'));
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });

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
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });
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
          return Promise.resolve(new Response(JSON.stringify(malformed), { status: 200 }));
        }
        return Promise.resolve(analysisResponse('two', '"two-v1"'));
      }),
    );
    await renderLoaded();
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });

    expect(await screen.findByRole('status')).toHaveTextContent(
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
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });

    expect(await screen.findByRole('status')).toHaveTextContent('network unavailable');
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
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });
    expect(screen.getByText(/cached-one/)).toBeInTheDocument();
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
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
      await fireEvent.change(screen.getByLabelText('Session'), { target: { value: id } });
      await waitFor(() => expect(screen.getByLabelText('Session')).toHaveValue(id));
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
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
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
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await screen.findByText(/two-model/);
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });
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

    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    expect(await screen.findByText(/two-model/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Refresh warnings' })).toHaveTextContent(
      'catalogue unavailable',
    );
    expect(screen.getByRole('status', { name: 'Refresh warnings' })).not.toHaveTextContent(
      'analysis unavailable',
    );

    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });
    const warnings = await screen.findByRole('status', { name: 'Refresh warnings' });
    await waitFor(() => expect(warnings).toHaveTextContent('analysis unavailable'));
    expect(warnings).toHaveTextContent('catalogue unavailable');
    expect(screen.getByRole('application', { name: 'Context River' })).toBeInTheDocument();

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
