import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { ROOM_NAV } from "@/lib/sections";

export type RoomAvailability = Record<string, boolean>;

/**
 * Which of the six room sections actually have something published. Wrapped
 * in React's `cache()` so the layout and whichever page is rendering can
 * both call this for the same project within one request without issuing
 * the underlying queries twice.
 */
export const getRoomAvailability = cache(
  async (projectId: string): Promise<RoomAvailability> => {
    const [docCounts, project, galleryCount, referenceCount] =
      await Promise.all([
        prisma.document.groupBy({
          by: ["section"],
          where: { projectId },
          _count: { _all: true },
        }),
        prisma.project.findUnique({
          where: { id: projectId },
          select: { aboutContent: true, aboutTeam: true },
        }),
        prisma.galleryItem.count({ where: { projectId } }),
        prisma.referenceLink.count({ where: { projectId } }),
      ]);

    const sectionsWithDocs = new Set(
      docCounts.filter((d) => d._count._all > 0).map((d) => d.section)
    );
    const aboutTeam = Array.isArray(project?.aboutTeam) ? project.aboutTeam : [];

    return {
      script: sectionsWithDocs.has("SCRIPT"),
      "creative-deck": sectionsWithDocs.has("CREATIVE_DECK"),
      financials: sectionsWithDocs.has("FINANCIALS"),
      "production-plan": sectionsWithDocs.has("PRODUCTION_PLAN"),
      about: Boolean(project?.aboutContent?.trim()) || aboutTeam.length > 0,
      gallery: galleryCount > 0 || referenceCount > 0,
    };
  }
);

/** First room-nav section (in nav order) that has something published, or null if none do. */
export function firstAvailableSection(
  availability: RoomAvailability
): string | null {
  for (const item of ROOM_NAV) {
    if (availability[item.slug]) return item.slug;
  }
  return null;
}
