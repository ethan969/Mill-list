import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  checkRateLimit,
  recordAttempt,
  clearAttempts,
  MAX_ATTEMPTS,
  WINDOW_MS,
} from "@/lib/rate-limit";

function testKey() {
  return `test:rate-limit:${crypto.randomUUID()}`;
}

describe("rate-limit (Postgres-backed)", () => {
  let key: string;

  beforeEach(() => {
    key = testKey();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await prisma.rateLimitAttempt.deleteMany({ where: { key } });
  });

  it("allows attempts under the threshold", async () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      const rate = await checkRateLimit(key);
      expect(rate.allowed).toBe(true);
      await recordAttempt(key);
    }
    const rate = await checkRateLimit(key);
    expect(rate.allowed).toBe(true);
  });

  it("blocks once the threshold is reached", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const rate = await checkRateLimit(key);
      expect(rate.allowed).toBe(true);
      await recordAttempt(key);
    }

    const blocked = await checkRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await checkRateLimit(key);
      await recordAttempt(key);
    }
    expect((await checkRateLimit(key)).allowed).toBe(false);

    // Advance past the window — the next check should treat this as a
    // fresh window rather than staying blocked.
    vi.advanceTimersByTime(WINDOW_MS + 1000);

    const afterWindow = await checkRateLimit(key);
    expect(afterWindow.allowed).toBe(true);
  });

  it("clearAttempts lets a key through immediately, even mid-window", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await checkRateLimit(key);
      await recordAttempt(key);
    }
    expect((await checkRateLimit(key)).allowed).toBe(false);

    await clearAttempts(key);

    expect((await checkRateLimit(key)).allowed).toBe(true);
  });

  it("keeps separate keys independent", async () => {
    const otherKey = testKey();
    try {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await checkRateLimit(key);
        await recordAttempt(key);
      }
      expect((await checkRateLimit(key)).allowed).toBe(false);
      expect((await checkRateLimit(otherKey)).allowed).toBe(true);
    } finally {
      await prisma.rateLimitAttempt.deleteMany({ where: { key: otherKey } });
    }
  });
});
