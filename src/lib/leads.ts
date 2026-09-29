import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

/**
 * x-forwarded-for is a chain where each hop APPENDS its own observed
 * remote address (standard reverse-proxy behavior — Vercel's edge network
 * included). A client can freely set any value for the *earlier* entries
 * simply by sending its own x-forwarded-for header, but never the last
 * one: that's set by whichever proxy made the final hop directly to us,
 * which for a request reaching this app is Vercel's own edge, not the
 * client. Trusting the first entry (the previous implementation) let a
 * client claim to be any IP it liked and completely defeated every
 * IP-keyed rate limit in this app (admin login, 2FA verification, room
 * passwords, download requests all key on this value) — a fresh spoofed
 * first entry on every request meant no single key ever crossed the
 * threshold.
 */
export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const hops = forwarded
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1]! : null;
}

export async function recordDownload(params: {
  // The document's own project, if it has one (null for a slate-level
  // document). slateId is separate and NOT mutually exclusive with
  // projectId: it records *which slate the access came through*, set
  // whenever a slate session was the credential used — even when
  // downloading a project-owned document via slate membership, so the
  // admin's download log can show both.
  projectId?: string | null;
  slateId?: string | null;
  documentId: string;
  email: string;
  request: NextRequest;
}) {
  return prisma.documentDownload.create({
    data: {
      projectId: params.projectId ?? null,
      slateId: params.slateId ?? null,
      documentId: params.documentId,
      email: params.email,
      ip: clientIp(params.request),
      userAgent: params.request.headers.get("user-agent"),
    },
  });
}
