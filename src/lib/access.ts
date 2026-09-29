import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRoomToken } from "@/lib/room-token";
import { verifySlateToken } from "@/lib/slate-token";

// Deliberately free of any next/headers import (same reason as
// room-token.ts/slate-token.ts) so canAccessProject/canAccessSlate can be
// called from src/proxy.ts directly. Route Handlers and proxy.ts both have
// a real NextRequest to read cookies from; Server Components (pages,
// layouts) don't, and use the cookies()-based equivalents in @/lib/auth
// instead, which share the cookie-list logic below.

export type CookieEntry = { name: string; value: string };

function withPrefix(entries: CookieEntry[], prefix: string) {
  return entries
    .filter((c) => c.name.startsWith(prefix))
    .map((c) => ({ slug: c.name.slice(prefix.length), value: c.value }));
}

export type ProjectAccessResult = {
  ok: boolean;
  /** The slate that granted access, if a slate session was the credential used — null for a direct room session. */
  viaSlateId: string | null;
};

/**
 * Either a valid, current-version room cookie for this exact project, or a
 * valid, current-version slate cookie for a slate that *currently*
 * includes this project — membership is checked live against
 * SlateProject on every call, never cached in the token, so removing a
 * film from a slate takes effect immediately for anyone already holding a
 * valid slate cookie. A direct room cookie is checked first and wins if
 * both are present, since that's the more specific credential.
 */
export async function resolveProjectAccess(
  entries: CookieEntry[],
  projectId: string
): Promise<ProjectAccessResult> {
  for (const { slug, value } of withPrefix(entries, "room_")) {
    const payload = await verifyRoomToken(value, slug);
    if (payload && payload.projectId === projectId) {
      return { ok: true, viaSlateId: null };
    }
  }

  for (const { slug, value } of withPrefix(entries, "slate_")) {
    const payload = await verifySlateToken(value, slug);
    if (!payload) continue;
    const membership = await prisma.slateProject.findUnique({
      where: { slateId_projectId: { slateId: payload.slateId, projectId } },
      select: { id: true },
    });
    if (membership) return { ok: true, viaSlateId: payload.slateId };
  }

  return { ok: false, viaSlateId: null };
}

/**
 * True if `entries` contains either a valid, current-version room cookie
 * for this exact project, or a valid, current-version slate cookie for a
 * slate that *currently* includes this project. A thin wrapper over
 * resolveProjectAccess() for callers that only need the yes/no answer —
 * use resolveProjectAccess() directly when which slate granted it also
 * matters (e.g. download logging).
 */
export async function projectAccessFromCookies(
  entries: CookieEntry[],
  projectId: string
): Promise<boolean> {
  return (await resolveProjectAccess(entries, projectId)).ok;
}

/** True if `entries` contains a valid, current-version cookie for this exact slate. */
export async function slateAccessFromCookies(
  entries: CookieEntry[],
  slateId: string
): Promise<boolean> {
  for (const { slug, value } of withPrefix(entries, "slate_")) {
    const payload = await verifySlateToken(value, slug);
    if (payload && payload.slateId === slateId) return true;
  }
  return false;
}

function entriesFromRequest(request: NextRequest): CookieEntry[] {
  return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
}

/** For Route Handlers and src/proxy.ts, which have a NextRequest to read cookies from. */
export async function canAccessProject(
  request: NextRequest,
  projectId: string
): Promise<boolean> {
  return projectAccessFromCookies(entriesFromRequest(request), projectId);
}

export async function canAccessSlate(
  request: NextRequest,
  slateId: string
): Promise<boolean> {
  return slateAccessFromCookies(entriesFromRequest(request), slateId);
}

export type DocumentAccessResult = {
  ok: boolean;
  /** The document's own project, or null for a slate-level document. */
  projectId: string | null;
  /** The document's own slate (if slate-level), or the slate that granted access to a project document — null for direct room access. */
  slateId: string | null;
};

/**
 * A document belongs to exactly one of a project or a slate (enforced at
 * the database level — see the slate-mode migration). Checks whichever
 * applies, and reports which slate (if any) actually granted the access —
 * needed for download logging, which records that separately from the
 * document's own ownership.
 */
export async function resolveDocumentAccess(
  request: NextRequest,
  documentId: string
): Promise<DocumentAccessResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { projectId: true, slateId: true },
  });
  if (!document) return { ok: false, projectId: null, slateId: null };

  if (document.projectId) {
    const result = await resolveProjectAccess(
      entriesFromRequest(request),
      document.projectId
    );
    return { ok: result.ok, projectId: document.projectId, slateId: result.viaSlateId };
  }

  if (document.slateId) {
    const ok = await canAccessSlate(request, document.slateId);
    return { ok, projectId: null, slateId: document.slateId };
  }

  return { ok: false, projectId: null, slateId: null };
}

/** A thin wrapper over resolveDocumentAccess() for callers that only need the yes/no answer. */
export async function canAccessDocument(
  request: NextRequest,
  documentId: string
): Promise<boolean> {
  return (await resolveDocumentAccess(request, documentId)).ok;
}
