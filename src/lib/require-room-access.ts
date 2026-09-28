import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canAccessProjectFromCookieStore } from "@/lib/auth";

/**
 * Confirms room access and returns the project id — call this as the
 * very first thing in every room section page, before any other data
 * fetching.
 *
 * Accepts either a room session for this project directly, or a slate
 * session for a slate that currently includes it — a slate visitor
 * reaches these same room pages via direct links, authorized by their
 * slate cookie rather than a separate room password (see @/lib/access).
 *
 * The room layout (src/app/[slug]/room/layout.tsx) already does this
 * same check, but Next.js can render/fetch a page's own Server Component
 * tree concurrently with its parent layout — a redirect() thrown in the
 * layout doesn't reliably stop a child page's own fetches from already
 * having run and been included in the response's RSC flight payload.
 * A direct (non-browser) HTTP request to a room page with no session, or
 * an old one invalidated by sessionVersion, could see a document's title
 * or other page-specific data in that raw payload even though a real
 * browser only ever follows the redirect and never renders it. Calling
 * this first in the page itself, not just relying on the layout, means
 * the sensitive fetch is never reached at all for an unauthorized
 * request, regardless of that rendering-order nuance.
 */
export async function requireRoomAccess(slug: string): Promise<{ projectId: string }> {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, isPublished: true },
  });
  if (!project || !project.isPublished) notFound();

  const allowed = await canAccessProjectFromCookieStore(project.id);
  if (!allowed) {
    redirect(`/${slug}`);
  }

  return { projectId: project.id };
}
