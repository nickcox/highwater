export interface RefreshResult {
  sessionNotFound?: boolean;
}

/** One request cycle at a time; signals received during work remain pending. */
export class RefreshScheduler {
  private active = false;
  private running = false;
  private generation = 0;
  private controller: AbortController | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingAt: number | null = null;
  private idleAt: number | null = null;
  private lastStart = -Infinity;
  private duration = 0;
  private retries = 0;
  constructor(
    private readonly cycle: (signal: AbortSignal) => Promise<RefreshResult>,
    private readonly now = () => performance.now(),
  ) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.request();
  }
  stop(): void {
    this.active = false;
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pendingAt = this.idleAt = null;
  }
  request(options: { idle?: boolean; retry?: boolean } = {}): void {
    if (!this.active) return;
    if (options.retry) this.retries = 0;
    const now = this.now();
    if (options.idle) this.idleAt = Math.max(this.idleAt ?? 0, now + 1000);
    else this.pendingAt = Math.min(this.pendingAt ?? Infinity, now);
    this.schedule();
  }
  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.active || this.running) return;
    const due = Math.min(this.pendingAt ?? Infinity, this.idleAt ?? Infinity);
    if (due === Infinity) return;
    const earliest = Math.max(due, this.lastStart + Math.max(2000, 5 * this.duration));
    this.timer = setTimeout(
      () => {
        void this.run();
      },
      Math.max(0, Math.ceil(earliest - this.now())),
    );
  }
  private async run(): Promise<void> {
    if (!this.active || this.running) return;
    const generation = this.generation;
    const controller = (this.controller = new AbortController());
    const started = (this.lastStart = this.now());
    if (this.pendingAt !== null && this.pendingAt <= started) this.pendingAt = null;
    if (this.idleAt !== null && this.idleAt <= started) this.idleAt = null;
    this.running = true;
    try {
      const result = await this.cycle(controller.signal);
      if (generation !== this.generation || controller.signal.aborted) return;
      if (result.sessionNotFound && this.retries < 3) {
        this.retries++;
        this.pendingAt = Math.min(this.pendingAt ?? Infinity, this.now() + 1000);
      } else if (!result.sessionNotFound) this.retries = 0;
    } catch {
      // The consumer records an error. Failed cycles still obey the same rate limit.
    } finally {
      if (generation === this.generation) {
        this.duration = Math.max(0, this.now() - started);
        this.running = false;
        this.controller = undefined;
        this.schedule();
      }
    }
  }
}
