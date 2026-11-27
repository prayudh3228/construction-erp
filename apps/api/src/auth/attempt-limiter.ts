import { type Clock } from './clock';

/**
 * Counts FAILED attempts per key (the client's network address) in a sliding window. Blocks a
 * source that keeps failing (password spraying across many accounts, or burning server time on
 * made-up usernames) without affecting an office full of people signing in correctly from one
 * shared address. In memory, per API process: enough for one server (A38).
 */
export class AttemptLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly clock: Clock,
  ) {}

  private recent(key: string): number[] {
    const cutoff = this.clock.now().getTime() - this.windowMs;
    const list = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) this.failures.delete(key);
    else this.failures.set(key, list);
    return list;
  }

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.maxFailures;
  }

  recordFailure(key: string): void {
    const list = this.recent(key);
    list.push(this.clock.now().getTime());
    this.failures.set(key, list);
    // Keep memory bounded if many sources fail once and never return.
    if (this.failures.size > 50_000) this.prune();
  }

  private prune(): void {
    for (const key of [...this.failures.keys()]) this.recent(key);
  }
}

/** At most `limit` password hashes at once; beyond `limit + queue` callers are turned away. */
export class HashGate {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly limit: number,
    private readonly queue: number,
  ) {}

  /** Runs `task` when a slot is free. Returns null (without running it) when too busy. */
  async run<T>(task: () => Promise<T>): Promise<T | null> {
    if (this.running >= this.limit) {
      if (this.waiting.length >= this.queue) return null;
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      return await task();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}
