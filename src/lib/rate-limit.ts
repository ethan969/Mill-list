import { prisma } from "@/lib/db";

/**
 * Postgres-backed rate limiter for password attempts (admin login, room
 * password entry). Fixed 10-minute window, 8 attempts, keyed by caller
 * (e.g. "admin-login:<ip>", "room:<slug>:<ip>"). Backed by the
 * RateLimitAttempt table specifically so this holds across Vercel's
 * separate serverless instances — a module-level in-memory Map (the
 * previous implementation) only holds within a single instance, which on
 * a serverless host doesn't meaningfully rate-limit anything.
 */

export const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_ATTEMPTS = 8;

// Expired rows are harmless (an expired row is just treated as a fresh
// window on its next read) but would otherwise grow the table forever,
// since most keys are never explicitly cleared. Rather than a separate
// cron job/route, each checkRateLimit call has a small chance of sweeping
// every already-expired row — cheap on the common path (one Math.random()
// call) and, across enough requests, keeps the table bounded without any
// new deployment infrastructure.
const SWEEP_PROBABILITY = 0.01;

export async function sweepExpiredAttempts(): Promise<number> {
  const { count } = await prisma.rateLimitAttempt.deleteMany({
    where: { resetAt: { lt: new Date() } },
  });
  return count;
}

export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (Math.random() < SWEEP_PROBABILITY) {
    await sweepExpiredAttempts();
  }

  const now = new Date();
  const entry = await prisma.rateLimitAttempt.findUnique({ where: { key } });

  if (!entry || entry.resetAt < now) {
    // No window yet, or the previous one has lapsed — start a fresh one.
    // (Mirrors the original in-memory behavior of eagerly creating an
    // entry on the first check, before any attempt is recorded.)
    await prisma.rateLimitAttempt.upsert({
      where: { key },
      create: { key, count: 0, resetAt: new Date(now.getTime() + WINDOW_MS) },
      update: { count: 0, resetAt: new Date(now.getTime() + WINDOW_MS) },
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordAttempt(key: string): Promise<void> {
  const now = new Date();
  const entry = await prisma.rateLimitAttempt.findUnique({ where: { key } });

  if (!entry || entry.resetAt < now) {
    await prisma.rateLimitAttempt.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + WINDOW_MS) },
      update: { count: 1, resetAt: new Date(now.getTime() + WINDOW_MS) },
    });
    return;
  }

  // Atomic at the database level (a single UPDATE ... SET count = count +
  // 1), so concurrent requests for the same key don't lose increments the
  // way a naive read-modify-write would.
  await prisma.rateLimitAttempt.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
}

export async function clearAttempts(key: string): Promise<void> {
  await prisma.rateLimitAttempt.deleteMany({ where: { key } });
}
