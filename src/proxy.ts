import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/seed"
  ) {
    // /api/admin/seed has its own gate (a token compared against
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
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
