import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import type { Summary } from '../contract';
import { HostFailure, highwaterError, readBody, request, type HighwaterServer } from './http';
import { summariseAnalysis } from './summary';

export interface AnalysisOptions {
  pieceBytes?: number;
  memoryBytes?: number;
  uncompressedBytes?: number;
  compressedBytes?: number;
  transferTtlMs?: number;
  timeoutMs?: number;
  now?: () => number;
  fetcher?: typeof fetch;
}
export interface AnalysisEntry {
  key: string;
  etag: string;
  bytes: Buffer;
  summary: Summary;
}
interface Transfer {
  entry: AnalysisEntry;
  expires: number;
  timer: NodeJS.Timeout;
}

class Slots {
  private active = 0;
  private waiting: { signal: AbortSignal; grant: () => void }[] = [];
  async acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) throw signal.reason;
    if (this.active >= 2)
      await new Promise<void>((resolve, reject) => {
        const waiter = {
          signal,
          grant: () => {
            signal.removeEventListener('abort', abort);
            resolve();
          },
        };
        const abort = () => {
          this.waiting = this.waiting.filter((item) => item !== waiter);
          reject(signal.reason);
        };
        this.waiting.push(waiter);
        signal.addEventListener('abort', abort, { once: true });
      });
    else this.active += 1;
    return () => {
      const next = this.waiting.shift();
      if (next) next.grant();
      else this.active -= 1;
    };
  }
}

export class Analyses {
  private readonly cache = new Map<string, AnalysisEntry>();
  private readonly inflight = new Map<string, Promise<AnalysisEntry>>();
  private readonly transfers = new Map<string, Transfer>();
  private readonly slots = new Slots();
  private readonly pieceBytes: number;
  private readonly memoryBytes: number;
  private readonly now: () => number;
  private generation = -1;
  private closed = false;
  constructor(private readonly options: AnalysisOptions = {}) {
    this.pieceBytes = options.pieceBytes ?? 4 * 1024 * 1024;
    if (this.pieceBytes < 1 || this.pieceBytes > 4 * 1024 * 1024)
      throw new Error('Invalid analysis piece size');
    this.memoryBytes = options.memoryBytes ?? 64 * 1024 * 1024;
    this.now = options.now ?? Date.now;
  }
  load(server: HighwaterServer, sessionId: string): Promise<AnalysisEntry> {
    if (this.closed)
      return Promise.reject(
        new HostFailure(503, 'processStopped', 'The Highwater host has been disposed.'),
      );
    if (this.generation !== server.generation) {
      this.cache.clear();
      this.generation = server.generation;
    }
    const key = `${server.generation}:${sessionId}`;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const work = this.fetch(server, sessionId, key);
    this.inflight.set(key, work);
    void work.finally(() => this.inflight.delete(key)).catch(() => {});
    return work;
  }
  private async fetch(
    server: HighwaterServer,
    sessionId: string,
    key: string,
  ): Promise<AnalysisEntry> {
    const timeoutMs = this.options.timeoutMs ?? 20_000;
    const started = Date.now();
    const deadline = AbortSignal.timeout(timeoutMs);
    let release: (() => void) | undefined;
    try {
      release = await this.slots.acquire(AbortSignal.any([deadline, server.signal]));
      const cached = this.cache.get(key);
      return await request(
        server,
        `/api/sessions/${encodeURIComponent(sessionId)}/analysis`,
        cached?.etag ?? null,
        Math.max(1, timeoutMs - (Date.now() - started)),
        async (response, signal) => {
          if (response.status === 304) {
            if (!cached)
              throw new HostFailure(
                502,
                'analysisInvalid',
                'Highwater returned an uncached analysis as not modified.',
              );
            this.remember(cached);
            return cached;
          }
          if (response.status !== 200) return highwaterError(response);
          const etag = response.headers.get('etag');
          if (!etag)
            throw new HostFailure(
              502,
              'analysisInvalid',
              'Highwater returned an analysis without an ETag.',
            );
          const body = await readBody(
            response,
            this.options.uncompressedBytes ?? 128 * 1024 * 1024,
          );
          let input: unknown;
          try {
            input = JSON.parse(body.toString('utf8'));
          } catch {
            throw new HostFailure(
              502,
              'analysisInvalid',
              'Highwater returned invalid analysis JSON.',
            );
          }
          const summary = summariseAnalysis(input);
          input = null;
          const chunks: Buffer[] = [];
          let length = 0;
          const limit = this.options.compressedBytes ?? 64 * 1024 * 1024;
          await pipeline(
            Readable.from([body]),
            createGzip(),
            new Writable({
              write(chunk: Buffer, _encoding, callback) {
                length += chunk.length;
                if (length > limit)
                  callback(
                    new HostFailure(
                      413,
                      'analysisTooLarge',
                      `Compressed analysis exceeds the ${limit}-byte limit.`,
                    ),
                  );
                else {
                  chunks.push(chunk);
                  callback();
                }
              },
            }),
            { signal },
          );
          const entry = { key, etag, summary, bytes: Buffer.concat(chunks, length) };
          if (this.closed || server.signal.aborted)
            throw new HostFailure(503, 'processStopped', 'Highwater stopped; retry the request.');
          this.remember(entry);
          return entry;
        },
        this.options.fetcher,
      );
    } catch (error) {
      if (server.signal.aborted)
        throw new HostFailure(503, 'processStopped', 'Highwater stopped; retry the request.');
      if (deadline.aborted)
        throw new HostFailure(
          504,
          'analysisTimeout',
          'Highwater did not respond before the request timed out.',
        );
      throw error;
    } finally {
      release?.();
    }
  }
  private pinned(entry: AnalysisEntry): boolean {
    return [...this.transfers.values()].some((transfer) => transfer.entry === entry);
  }
  private used(extra: AnalysisEntry, replacing: boolean): number {
    const entries = new Set(
      [...this.cache.values()].filter((entry) => !replacing || entry.key !== extra.key),
    );
    for (const transfer of this.transfers.values()) entries.add(transfer.entry);
    entries.add(extra);
    return [...entries].reduce((total, entry) => total + entry.bytes.length, 0);
  }
  private makeSpace(entry: AnalysisEntry, replacing = false): void {
    this.expire();
    if (entry.bytes.length > this.memoryBytes)
      throw new HostFailure(
        413,
        'analysisTooLarge',
        'This analysis exceeds the host transfer memory limit.',
      );
    while (this.used(entry, replacing) > this.memoryBytes) {
      const removable = [...this.cache.values()].find(
        (candidate) =>
          candidate !== entry &&
          (!replacing || candidate.key !== entry.key) &&
          !this.pinned(candidate),
      );
      if (!removable)
        throw new HostFailure(
          503,
          'transferBusy',
          'Other analyses are still being transferred; retry shortly.',
        );
      this.cache.delete(removable.key);
    }
  }
  private remember(entry: AnalysisEntry): void {
    if (this.closed)
      throw new HostFailure(503, 'processStopped', 'The Highwater host has been disposed.');
    this.makeSpace(entry, true);
    this.cache.delete(entry.key);
    this.cache.set(entry.key, entry);
    while (this.cache.size > 2) this.cache.delete(this.cache.keys().next().value!);
  }
  open(entry: AnalysisEntry) {
    if (this.closed)
      throw new HostFailure(503, 'processStopped', 'The Highwater host has been disposed.');
    this.makeSpace(entry);
    const transferId = randomUUID();
    const ttl = this.options.transferTtlMs ?? 60_000;
    const timer = setTimeout(() => this.close(transferId), ttl);
    timer.unref();
    this.transfers.set(transferId, { entry, expires: this.now() + ttl, timer });
    return {
      status: 'ok' as const,
      etag: entry.etag,
      transferId,
      pieceCount: Math.ceil(entry.bytes.length / this.pieceBytes),
      firstPiece: entry.bytes.subarray(0, this.pieceBytes).toString('base64'),
    };
  }
  read(transferId: string, index: number): { piece: string } | { expired: true } {
    this.expire();
    const transfer = this.transfers.get(transferId);
    if (!transfer || index * this.pieceBytes >= transfer.entry.bytes.length)
      return { expired: true };
    return {
      piece: transfer.entry.bytes
        .subarray(index * this.pieceBytes, (index + 1) * this.pieceBytes)
        .toString('base64'),
    };
  }
  close(transferId: string): { closed: true } {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      clearTimeout(transfer.timer);
      this.transfers.delete(transferId);
    }
    return { closed: true };
  }
  private expire(): void {
    for (const [id, transfer] of this.transfers) if (transfer.expires <= this.now()) this.close(id);
  }
  dispose(): void {
    this.closed = true;
    for (const id of this.transfers.keys()) this.close(id);
    this.cache.clear();
  }
}
