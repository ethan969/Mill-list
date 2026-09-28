import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

// Deliberately free of any `next/headers` import (unlike auth.ts, which
// wraps these in cookie-store helpers) so this module can be loaded from
// src/proxy.ts, which runs before Next's per-request RSC context — where
// next/headers's cookies() is not available — as well as from ordinary
// server code and standalone test runners.

const secretValue = process.env.SESSION_SECRET;
if (!secretValue || secretValue.length < 16) {
  throw new Error(
    "SESSION_SECRET must be set to a strong random string (see .env.example)."
  );
}
const secret = new TextEncoder().encode(secretValue);

const ROOM_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type RoomSessionPayload = {
  kind: "room";
  projectId: string;
  slug: string;
  sessionVersion: number;
};

export function roomCookieName(slug: string) {
  return `room_${slug}`;
}

/** Signs a room token carrying the project's sessionVersion at issue time. */
export async function signRoomToken(
  projectId: string,
  slug: string,
  sessionVersion: number
): Promise<string> {
  return new SignJWT({ kind: "room", projectId, slug, sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS)
    .sign(secret);
}

export { ROOM_TTL_SECONDS };

/**
 * Verifies a room token's signature/shape *and* that its sessionVersion
 * still matches the project's current one in the database — a password
 * change or an explicit revoke (both bump Project.sessionVersion) makes
 * every token signed before that moment fail here, even though the JWT
 * itself is still validly signed and unexpired.
 */
export async function verifyRoomToken(
  token: string,
  slug: string
): Promise<RoomSessionPayload | null> {
  let payload: RoomSessionPayload;
  try {
    const result = await jwtVerify(token, secret);
    payload = result.payload as unknown as RoomSessionPayload;
  } catch {
    return null;
  }
  if (payload.kind !== "room" || payload.slug !== slug) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { sessionVersion: true },
  });
  if (!project || project.sessionVersion !== payload.sessionVersion) {
    return null;
  }

  return payload;
}
