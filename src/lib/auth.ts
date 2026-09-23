import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const secretValue = process.env.SESSION_SECRET;
if (!secretValue || secretValue.length < 16) {
  throw new Error(
    "SESSION_SECRET must be set to a strong random string (see .env.example)."
  );
}
const secret = new TextEncoder().encode(secretValue);

const ADMIN_COOKIE = "admin_session";
const ADMIN_TTL_SECONDS = 60 * 60 * 12; // 12 hours
const PENDING_2FA_COOKIE = "admin_2fa_pending";
const PENDING_2FA_TTL_SECONDS = 60 * 5; // 5 minutes — just long enough to enter a code
const ROOM_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const DOWNLOAD_LINK_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function roomCookieName(slug: string) {
  return `room_${slug}`;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

type AdminSessionPayload = {
  kind: "admin";
  sub: string;
  email: string;
};

/**
 * Issued right after a correct password, before 2FA is checked — proves
 * the password was right without granting admin access yet. Deliberately
 * short-lived and never accepted by requireAdmin()/proxy.ts.
 */
type PendingTwoFactorPayload = {
  kind: "admin-pending-2fa";
  sub: string;
  email: string;
};

type RoomSessionPayload = {
  kind: "room";
  projectId: string;
  slug: string;
};

type DownloadLinkPayload = {
  kind: "download";
  downloadId: string;
  documentId: string;
  email: string;
};

async function sign(
  payload:
    | AdminSessionPayload
    | PendingTwoFactorPayload
    | RoomSessionPayload
    | DownloadLinkPayload,
  ttlSeconds: number
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);
}

async function verify<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as T;
  } catch {
    return null;
  }
}

// ---- Admin sessions ----

export async function createAdminSession(sub: string, email: string) {
  const token = await sign({ kind: "admin", sub, email }, ADMIN_TTL_SECONDS);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  });
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify<AdminSessionPayload>(token);
  if (!payload || payload.kind !== "admin") return null;
  return payload;
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/** For API routes: returns the admin session, or null if not authenticated. */
export async function requireAdmin(): Promise<AdminSessionPayload | null> {
  return getAdminSession();
}

// ---- Pending 2FA sessions (between password check and code check) ----

export async function createPendingTwoFactorSession(sub: string, email: string) {
  const token = await sign(
    { kind: "admin-pending-2fa", sub, email },
    PENDING_2FA_TTL_SECONDS
  );
  const store = await cookies();
  store.set(PENDING_2FA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_2FA_TTL_SECONDS,
  });
}

export async function getPendingTwoFactorSession(): Promise<PendingTwoFactorPayload | null> {
  const store = await cookies();
  const token = store.get(PENDING_2FA_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify<PendingTwoFactorPayload>(token);
  if (!payload || payload.kind !== "admin-pending-2fa") return null;
  return payload;
}

export async function destroyPendingTwoFactorSession() {
  const store = await cookies();
  store.delete(PENDING_2FA_COOKIE);
}

// ---- Data room sessions (per project) ----

export async function createRoomSession(projectId: string, slug: string) {
  const token = await sign({ kind: "room", projectId, slug }, ROOM_TTL_SECONDS);
  const store = await cookies();
  store.set(roomCookieName(slug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ROOM_TTL_SECONDS,
  });
}

export async function getRoomSession(
  slug: string
): Promise<RoomSessionPayload | null> {
  const store = await cookies();
  const token = store.get(roomCookieName(slug))?.value;
  if (!token) return null;
  const payload = await verify<RoomSessionPayload>(token);
  if (!payload || payload.kind !== "room" || payload.slug !== slug) {
    return null;
  }
  return payload;
}

export async function destroyRoomSession(slug: string) {
  const store = await cookies();
  store.delete(roomCookieName(slug));
}

/**
 * Verify a room session using the raw cookie header from a Request (for use
 * in Route Handlers that stream files and must confirm access to a specific
 * project without relying on the ambient cookies() store matching).
 */
export async function verifyRoomAccessForProject(
  slug: string,
  projectId: string
): Promise<boolean> {
  const session = await getRoomSession(slug);
  return Boolean(session && session.projectId === projectId);
}

// ---- Emailed download links ----
// A watermarked-download request doesn't hand the file to the browser that
// asked for it — it emails a signed link to the address the visitor typed,
// which may be opened on a different device with no room session cookie at
// all. The token below is the download's only credential, so it carries
// everything needed to authorize and watermark that one file.

export async function createDownloadToken(payload: {
  downloadId: string;
  documentId: string;
  email: string;
}): Promise<string> {
  return sign({ kind: "download", ...payload }, DOWNLOAD_LINK_TTL_SECONDS);
}

export async function verifyDownloadToken(
  token: string
): Promise<DownloadLinkPayload | null> {
  const payload = await verify<DownloadLinkPayload>(token);
  if (!payload || payload.kind !== "download") return null;
  return payload;
}
