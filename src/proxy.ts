import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { verifyRoomToken } from "@/lib/room-token";

const secretValue = process.env.SESSION_SECRET || "";
const secret = new TextEncoder().encode(secretValue);

async function hasValidAdminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("admin_session")?.value;
  if (!token || !secretValue) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.kind === "admin";
  } catch {
    return false;
  }
}

// Proxy defaults to the Node.js runtime in Next.js 16, so it can call
// verifyRoomToken directly (Prisma included) — this stops an unauthenticated
// or session-version-revoked request from ever reaching room page code,
// rather than relying solely on the page-level requireRoomAccess() guard.
async function hasValidRoomSession(
  request: NextRequest,
  slug: string
): Promise<boolean> {
  const token = request.cookies.get(`room_${slug}`)?.value;
  if (!token) return false;
  const payload = await verifyRoomToken(token, slug);
  return Boolean(payload);
}

const ADMIN_API_2FA_EXEMPT = new Set([
  "/api/admin/login",
  "/api/admin/seed",
  "/api/admin/2fa/setup",
  "/api/admin/2fa/confirm",
  "/api/admin/2fa/verify",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    // Sign-in and its 2FA follow-up screens: reachable before a full admin
    // session exists (that's the point of them). Each of the 2FA API
    // routes checks the short-lived pending-2FA session itself.
    pathname === "/admin/login" ||
    pathname === "/admin/login/setup-2fa" ||
    pathname === "/admin/login/verify-2fa" ||
    ADMIN_API_2FA_EXEMPT.has(pathname)
  ) {
    // /api/admin/seed has its own separate gate (a token compared against
    // SESSION_SECRET, in the route handler itself) — it must be reachable
    // before an admin session exists, since it's what creates the first one.
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    const ok = await hasValidAdminSession(request);
    if (!ok) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const ok = await hasValidAdminSession(request);
    if (!ok) {
      const url = new URL("/admin/login", request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const roomMatch = pathname.match(/^\/([^/]+)\/room(?:\/|$)/);
  if (roomMatch) {
    const slug = roomMatch[1];
    const ok = await hasValidRoomSession(request, slug);
    if (!ok) {
      const url = new URL(`/${slug}`, request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/:slug/room/:path*"],
};
