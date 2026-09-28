import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

// Mirrors room-token.ts exactly, for the same reason: deliberately free of
// any next/headers import so this can be loaded from src/proxy.ts (which
// runs before Next's per-request RSC cookie context) as well as from
// ordinary server code and standalone test runners.

const secretValue = process.env.SESSION_SECRET;
if (!secretValue || secretValue.length < 16) {
  throw new Error(
    "SESSION_SECRET must be set to a strong random string (see .env.example)."
  );
}
const secret = new TextEncoder().encode(secretValue);

const SLATE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches room sessions

export type SlateSessionPayload = {
  kind: "slate";
  slateId: string;
  slug: string;
  sessionVersion: number;
};

export function slateCookieName(slug: string) {
  return `slate_${slug}`;
}

/** Signs a slate token carrying the slate's sessionVersion at issue time. */
export async function signSlateToken(
  slateId: string,
  slug: string,
  sessionVersion: number
): Promise<string> {
  return new SignJWT({ kind: "slate", slateId, slug, sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SLATE_TTL_SECONDS)
    .sign(secret);
}

export { SLATE_TTL_SECONDS };

/**
 * Verifies a slate token's signature/shape *and* that its sessionVersion
 * still matches the slate's current one in the database — a password
 * change or an explicit revoke (both bump Slate.sessionVersion) makes
 * every token signed before that moment fail here, even though the JWT
 * itself is still validly signed and unexpired.
 */
export async function verifySlateToken(
  token: string,
  slug: string
): Promise<SlateSessionPayload | null> {
  let payload: SlateSessionPayload;
  try {
    const result = await jwtVerify(token, secret);
    payload = result.payload as unknown as SlateSessionPayload;
  } catch {
    return null;
  }
  if (payload.kind !== "slate" || payload.slug !== slug) {
    return null;
  }

  const slate = await prisma.slate.findUnique({
    where: { slug },
    select: { sessionVersion: true },
  });
  if (!slate || slate.sessionVersion !== payload.sessionVersion) {
    return null;
  }

  return payload;
}
