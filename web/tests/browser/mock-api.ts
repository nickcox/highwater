import type { Page } from '@playwright/test';
import { testAnalysis } from '../../src/lib/context-river/test-data';
import type { SessionAnalysis, WireSessionAnalysis } from '../../src/lib/types';
import { toWireAnalysis } from '../../src/lib/testing/wire-analysis';

export const generation = '0123456789abcdef0123456789abcdef';

export async function mockApi(
  page: Page,
  sourceAnalysis: SessionAnalysis | WireSessionAnalysis = testAnalysis(),
): Promise<void> {
  await page.addInitScript((liveGeneration: string) => {
    class StableEventSource extends EventTarget {
      readonly url: string;
      readonly withCredentials = false;
      private state = 0;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor(url: string | URL) {
        super();
        this.url = String(url);
        window.addEventListener('mockSessionsChanged', this.forwardCatalogue);
        queueMicrotask(() => {
          if (this.state === 2) return;
          this.state = 1;
          this.onopen?.(new Event('open'));
          this.dispatchEvent(
            new MessageEvent('liveStatus', {
              data: JSON.stringify({ generation: liveGeneration, availability: 'active' }),
            }),
          );
        });
      }
      get readyState(): number {
        return this.state;
      }
      private forwardCatalogue = (event: Event): void => {
        this.dispatchEvent(
          new MessageEvent('sessionsChanged', { data: (event as MessageEvent).data }),
        );
      };
      close(): void {
        this.state = 2;
        window.removeEventListener('mockSessionsChanged', this.forwardCatalogue);
      }
    }
    (window as unknown as { EventSource: typeof EventSource }).EventSource =
      StableEventSource as unknown as typeof EventSource;
  }, generation);
  const analysis = structuredClone(sourceAnalysis);
  analysis.session.id = 'browser-smoke';
  await page.route('**/api/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        etag: '"catalog-v0"',
        'X-Highwater-Server-Generation': generation,
        'X-Highwater-Catalog-Revision': '0',
        'X-Highwater-Live-Updates': 'active',
      },
      body: JSON.stringify({
        sessions: [
          {
            id: 'browser-smoke',
            fileName: 'browser-smoke.jsonl',
            displayName: 'Sanitized browser smoke fixture',
            workingDirectory: '/tmp/highwater-browser-smoke',
            startedAt: null,
            byteSize: 1,
            modifiedAt: null,
          },
        ],
      }),
    });
  });
  await page.route('**/api/sessions/**/analysis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { etag: '"analysis-v0"' },
      body: JSON.stringify(toWireAnalysis(analysis)),
    });
  });
}
