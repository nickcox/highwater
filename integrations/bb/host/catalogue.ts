import { z } from 'zod';
import { HostFailure, highwaterError, readBody, request, type HighwaterServer } from './http';

const entrySchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),
  harness: z.string(),
  fileName: z.string(),
  parentReference: z.string().nullable().optional(),
  modifiedAt: z.string().nullable().optional(),
});
const catalogueSchema = z.object({ sessions: z.array(entrySchema) });
export type CatalogueEntry = z.infer<typeof entrySchema>;

function modifiedNanos(entry: CatalogueEntry): bigint {
  const text = entry.modifiedAt ?? '';
  const millis = Date.parse(text);
  if (!Number.isFinite(millis)) return 0n;
  // Highwater timestamps retain nanoseconds; Date.parse alone would tie distinct files.
  const fraction = /\.(\d{1,9})(?:Z|[+-]\d{2}:\d{2})$/.exec(text)?.[1] ?? '';
  return BigInt(millis) * 1_000_000n + BigInt(fraction.padEnd(9, '0').slice(3));
}

export function matchSession(
  entries: CatalogueEntry[],
  harness: 'pi' | 'claude-code',
  providerThreadId: string,
): string | null {
  const filename = `${harness === 'pi' ? providerThreadId.replace(/[^A-Za-z0-9._-]/g, '_') : providerThreadId}.jsonl`;
  return (
    entries
      .filter(
        (entry) =>
          entry.harness === harness && entry.parentReference == null && entry.fileName === filename,
      )
      .sort((a, b) => {
        const left = modifiedNanos(a),
          right = modifiedNanos(b);
        return left === right ? a.id.localeCompare(b.id) : left > right ? -1 : 1;
      })[0]?.id ?? null
  );
}

export class SessionCatalogue {
  private generation = -1;
  private cached: { etag: string; entries: CatalogueEntry[] } | null = null;
  private inflight = new Map<number, Promise<CatalogueEntry[]>>();
  constructor(
    private readonly timeoutMs = 20_000,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  list(server: HighwaterServer): Promise<CatalogueEntry[]> {
    if (this.generation !== server.generation) {
      this.cached = null;
      this.generation = server.generation;
    }
    const pending = this.inflight.get(server.generation);
    if (pending) return pending;
    const cached = this.cached;
    const work = request(
      server,
      '/api/sessions',
      cached?.etag ?? null,
      this.timeoutMs,
      async (response) => {
        if (response.status === 304) {
          if (!cached)
            throw new HostFailure(
              502,
              'catalogueInvalid',
              'Highwater returned an uncached catalogue as not modified.',
            );
          return cached.entries;
        }
        if (response.status !== 200) return highwaterError(response);
        const body = await readBody(response, 8 * 1024 * 1024);
        let input: unknown;
        try {
          input = JSON.parse(body.toString('utf8'));
        } catch {
          throw new HostFailure(
            502,
            'catalogueInvalid',
            'Highwater returned invalid catalogue JSON.',
          );
        }
        const parsed = catalogueSchema.safeParse(input);
        const etag = response.headers.get('etag');
        if (!parsed.success || !etag)
          throw new HostFailure(
            502,
            'catalogueInvalid',
            'Highwater returned an invalid session catalogue.',
          );
        if (this.generation === server.generation && !server.signal.aborted)
          this.cached = { etag, entries: parsed.data.sessions };
        return parsed.data.sessions;
      },
      this.fetcher,
    );
    this.inflight.set(server.generation, work);
    void work.finally(() => this.inflight.delete(server.generation)).catch(() => {});
    return work;
  }
  clear(): void {
    this.cached = null;
  }
}
