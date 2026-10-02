import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSlateSession } from "@/lib/auth";

export type SlateFilmAccessResult =
  | { ok: true; slateId: string; projectId: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "unauthenticated" };

/**
 * The non-throwing check behind requireSlateFilmAccess() below and this
 * route's generateMetadata() (src/app/slate/[slug]/[projectSlug]/page.tsx)
 * — same logic, but returns a result instead of calling redirect()/
 * notFound(), so generateMetadata can fall back to an empty Metadata
 * object instead of a title that would otherwise render in <head> (and in
 * the RSC flight payload) independently of whatever the page body itself
 * does, including before authentication.
 *
 * Order matters for no-enumeration: the slate session is checked *before*
 * the project/membership lookups, so an unauthenticated visitor always
 * gets the same "go log in" outcome regardless of whether the project
 * slug they guessed exists or belongs to this slate — a 404 (meaning
 * "not a member") is only ever possible once a valid session already
 * proves they belong to this slate. Checking membership first would let
 * an unauthenticated visitor distinguish "this slate includes that film"
 * (redirect) from "it doesn't, or the slug isn't real" (404) without ever
 * knowing the password.
 */
export async function resolveSlateFilmAccess(
  slateSlug: string,
  projectSlug: string
): Promise<SlateFilmAccessResult> {
  const slate = await prisma.slate.findUnique({
    where: { slug: slateSlug },
    select: { id: true, isPublished: true },
  });
  if (!slate || !slate.isPublished) return { ok: false, reason: "not-found" };

  const session = await getSlateSession(slateSlug);
  if (!session || session.slateId !== slate.id) {
    return { ok: false, reason: "unauthenticated" };
  }

  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  if (!project) return { ok: false, reason: "not-found" };

  const membership = await prisma.slateProject.findUnique({
    where: { slateId_projectId: { slateId: slate.id, projectId: project.id } },
    select: { id: true },
  });
  if (!membership) return { ok: false, reason: "not-found" };

  return { ok: true, slateId: slate.id, projectId: project.id };
}

/**
 * Confirms access to a single film's dedicated page within a slate
 * (src/app/slate/[slug]/[projectSlug]) — call this as the first thing in
 * that page, before any other data fetching (same reasoning as
 * requireRoomAccess: don't let a page-level fetch run for an unauthorized
 * request just because Next.js can render a page concurrently with its
 * layout).
 *
 * Deliberately independent of Project.isPublished — a film's dedicated
 * slate page is presented and access-controlled entirely through the
 * slate (live SlateProject membership + a valid slate session for this
 * slate), not through that project's own draft/published state or its
 * own password.
 */
export async function requireSlateFilmAccess(
  slateSlug: string,
  projectSlug: string
): Promise<{ slateId: string; projectId: string }> {
  const result = await resolveSlateFilmAccess(slateSlug, projectSlug);
  if (result.ok) return { slateId: result.slateId, projectId: result.projectId };
  if (result.reason === "unauthenticated") redirect(`/slate/${slateSlug}`);
  notFound();
}
