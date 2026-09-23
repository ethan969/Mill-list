import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { DocumentSection } from "@prisma/client";

export async function getSectionDocuments(
  slug: string,
  section: DocumentSection
) {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) notFound();

  const documents = await prisma.document.findMany({
    where: { projectId: project.id, section },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      pageCount: true,
      pageWidth: true,
      pageHeight: true,
    },
  });

  return { projectId: project.id, documents };
}
