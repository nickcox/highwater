import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.svelte';
import { testAnalysis } from './lib/context-river/test-data';

let modifyAnalysis: ((analysis: ReturnType<typeof testAnalysis>) => void) | null = null;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  modifyAnalysis = null;
  Object.defineProperty(SVGSVGElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: 960, height: 500, right: 960, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }),
  });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/sessions') {
      return new Response(JSON.stringify({ sessions: [
        { id: 'one', fileName: 'one.jsonl', displayName: 'one', workingDirectory: null, startedAt: null, byteSize: 1, modifiedAt: null },
        { id: 'two', fileName: 'two.jsonl', displayName: 'two', workingDirectory: null, startedAt: null, byteSize: 1, modifiedAt: null },
      ] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const analysis = testAnalysis();
    modifyAnalysis?.(analysis);
    analysis.session.id = url.includes('two') ? 'two' : 'one';
    return new Response(JSON.stringify(analysis), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
});

async function renderLoaded() {
  const result = render(App);
  await screen.findByRole('application', { name: 'Context River' });
  return result;
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

function sessionListResponse(ids = ['one', 'two']): Response {
  return new Response(JSON.stringify({
    sessions: ids.map((id) => ({
      id,
      fileName: `${id}.jsonl`,
      displayName: id,
      workingDirectory: null,
      startedAt: null,
      byteSize: 1,
      modifiedAt: null,
    })),
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
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
    const ribbon = screen.getByRole('button', { name: 'toolResult: bash: npm test' });
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
    await fireEvent.click(screen.getByRole('button', { name: 'toolResult: first line' }));
    const summary = screen.getByText('Show more context');
    summary.focus();
    expect(document.activeElement).toBe(summary);
    await fireEvent.keyDown(summary, { key: 'Enter' });
    const details = container.querySelector('.preview-details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(container.querySelector('.preview-details pre')?.textContent).toBe('first line\n<img src=x onerror=alert(1)>');
    expect(container.querySelector('.preview-details img')).not.toBeInTheDocument();
  });

  it('renders concise tool labels in the pinned call panel', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 1' }));
    expect(screen.getByText('Tools invoked after this response')).toBeInTheDocument();
    expect(document.querySelector('.tool-chip')).toHaveTextContent('bash');
    expect(screen.getByText('Technical tool-call IDs')).toBeInTheDocument();
  });

  it('selects a ribbon, dims unrelated items, and highlights compaction lineage', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'toolResult: bash: npm test' }));
    expect(screen.getByText('Follow Context active')).toBeInTheDocument();
    expect(container.querySelectorAll('.ribbon-group.dimmed').length).toBeGreaterThan(0);
    expect(container.querySelector('.lineage-connector.visible')).toBeInTheDocument();
  });

  it('selects the same item from a lifespan segment', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: /bash: npm test, calls 1 through 2/ }));
    expect(screen.getByText('Follow Context active')).toBeInTheDocument();
    expect(screen.getByText('bash: npm test', { selector: '.item-details h3' })).toBeInTheDocument();
  });

  it('empty-space click clears item selection while pinning a call', async () => {
    const { container } = await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'toolResult: bash: npm test' }));
    await fireEvent.click(container.querySelector('.plot-background')!, { clientX: 300 });
    expect(screen.queryByText('Follow Context active')).not.toBeInTheDocument();
    expect(screen.getByText('Pinned call', { exact: false })).toBeInTheDocument();
  });

  it('Reset clears selected item and pinned call', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'toolResult: bash: npm test' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Reset focus' }));
    expect(screen.queryByText('Follow Context active')).not.toBeInTheDocument();
    expect(screen.queryByText('Pinned call', { exact: false })).not.toBeInTheDocument();
  });

  it('session changes clear stale interaction state', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'toolResult: bash: npm test' }));
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await waitFor(() => expect(screen.queryByText('Follow Context active')).not.toBeInTheDocument());
  });

  it('renders transcript labels as text rather than HTML', async () => {
    const { container } = await renderLoaded();
    expect(screen.getAllByText('<img src=x onerror=alert(1)>').length).toBeGreaterThan(0);
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('supports keyboard item selection and staged Escape reset', async () => {
    await renderLoaded();
    const ribbon = screen.getByRole('button', { name: 'toolResult: bash: npm test' });
    ribbon.focus();
    await fireEvent.keyDown(ribbon, { key: 'Enter' });
    expect(screen.getByText('Follow Context active')).toBeInTheDocument();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Follow Context active')).not.toBeInTheDocument();
  });

  it('does not let a focused SVG Escape clear selection and pin together', async () => {
    await renderLoaded();
    await fireEvent.click(screen.getByRole('button', { name: 'Pin model call 2' }));
    const ribbon = screen.getByRole('button', { name: 'toolResult: bash: npm test' });
    await fireEvent.click(ribbon);
    ribbon.focus();

    await fireEvent.keyDown(ribbon, { key: 'Escape' });
    expect(screen.queryByText('Follow Context active')).not.toBeInTheDocument();
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
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
      if (url.includes('/one/')) {
        oneRequests += 1;
        if (oneRequests === 1) return Promise.resolve(analysisResponse('one', '"one-v1"'));
        conditionalHeader = new Headers(init?.headers).get('If-None-Match');
        return refresh.promise;
      }
      return Promise.resolve(analysisResponse('two', '"two-v1"'));
    }));
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
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
      if (url.includes('/one/')) {
        oneRequests += 1;
        return oneRequests === 1
          ? Promise.resolve(analysisResponse('one', '"one-v1"', 'old-model'))
          : refresh.promise;
      }
      return Promise.resolve(analysisResponse('two', '"two-v1"'));
    }));
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
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
      if (url.includes('/one/')) {
        oneRequests += 1;
        if (oneRequests === 1) return Promise.resolve(analysisResponse('one', '"one-v1"', 'cached-model'));
        const malformed = testAnalysis();
        malformed.schemaVersion = 999;
        return Promise.resolve(new Response(JSON.stringify(malformed), { status: 200 }));
      }
      return Promise.resolve(analysisResponse('two', '"two-v1"'));
    }));
    await renderLoaded();
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'two' } });
    await fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'one' } });

    expect(await screen.findByRole('status')).toHaveTextContent('Refresh failed; showing cached analysis');
    expect(screen.getByText(/cached-model/)).toBeInTheDocument();
    expect(screen.queryByText('Could not render this session')).not.toBeInTheDocument();
  });

  it('uses a non-destructive warning when a cached refresh request fails', async () => {
    let oneRequests = 0;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
      if (url.includes('/one/')) {
        oneRequests += 1;
        return oneRequests === 1
          ? Promise.resolve(analysisResponse('one', '"one-v1"', 'cached-model'))
          : Promise.reject(new Error('network unavailable'));
      }
      return Promise.resolve(analysisResponse('two', '"two-v1"'));
    }));
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
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/sessions') return Promise.resolve(sessionListResponse());
      if (url.includes('/one/')) {
        oneRequests += 1;
        if (oneRequests === 1) return Promise.resolve(analysisResponse('one', '"one-v1"', 'cached-one'));
        return lateRefresh.promise;
      }
      return Promise.resolve(analysisResponse('two', '"two-v1"', 'selected-two'));
    }));
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
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/sessions') return Promise.resolve(sessionListResponse(['one', 'two', 'three', 'four']));
      const id = ['one', 'two', 'three', 'four'].find((candidate) => url.includes(`/${candidate}/`))!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (id === 'one' && counts.get(id) === 2) {
        expect(new Headers(init?.headers).get('If-None-Match')).toBeNull();
      }
      return Promise.resolve(analysisResponse(id, `"${id}-v1"`));
    }));
    await renderLoaded();
    for (const id of ['two', 'three', 'four', 'one']) {
      await fireEvent.change(screen.getByLabelText('Session'), { target: { value: id } });
      await waitFor(() => expect(screen.getByLabelText('Session')).toHaveValue(id));
    }
    await waitFor(() => expect(counts.get('one')).toBe(2));
  });
});
