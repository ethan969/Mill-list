import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSlateSession } from "@/lib/auth";

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
 * slate (live SlateProject membership + a valid slate session), not
 * through that project's own draft/published state or its own password.
 */
export async function requireSlateFilmAccess(
  slateSlug: string,
  projectSlug: string
): Promise<{ slateId: string; projectId: string }> {
  const slate = await prisma.slate.findUnique({
    where: { slug: slateSlug },
    select: { id: true, isPublished: true },
  });
  if (!slate || !slate.isPublished) notFound();

  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  if (!project) notFound();

  const membership = await prisma.slateProject.findUnique({
    where: { slateId_projectId: { slateId: slate.id, projectId: project.id } },
    select: { id: true },
  });
  if (!membership) notFound();

  const session = await getSlateSession(slateSlug);
  if (!session || session.slateId !== slate.id) {
    redirect(`/slate/${slateSlug}`);
  }

  return { slateId: slate.id, projectId: project.id };
}
