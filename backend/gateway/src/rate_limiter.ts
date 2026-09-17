/**
 * In-memory sliding-window rate limiter per user identifier.
 */
export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const timestamps = this.windows.get(key) ?? [];
    const valid = timestamps.filter((t) => now - t < this.windowMs);

    if (valid.length >= this.limit) {
      this.windows.set(key, valid);
      const oldest = valid[0];
      const resetMs = oldest ? oldest + this.windowMs - now : this.windowMs;
      return { allowed: false, remaining: 0, resetMs: Math.max(0, resetMs) };
    }

    valid.push(now);
    this.windows.set(key, valid);
    return { allowed: true, remaining: this.limit - valid.length, resetMs: this.windowMs };
  }

  reset(key?: string): void {
    if (key) {
      this.windows.delete(key);
    } else {
      this.windows.clear();
    }
  }
}
