import "server-only";
import { prisma } from "@/lib/db";
import type { DocumentSection } from "@prisma/client";

// Exactly one of projectId/slateId is set — enforced at the database level
// (see the Document_project_or_slate_check constraint added in the
// slate-mode migration).
type DocumentOwner =
  | { projectId: string; slateId?: undefined }
  | { projectId?: undefined; slateId: string };

export async function createDocumentRecord(
  params: DocumentOwner & {
    section: DocumentSection;
    title?: string | null;
    fileName: string;
    mimeType: string;
    fileSize: number;
    fileKey: string;
    pageWidth?: number | null;
    pageHeight?: number | null;
  }
) {
  const finalTitle =
    params.title && params.title.trim().length > 0
      ? params.title.trim()
      : params.fileName.replace(/\.pdf$/i, "");

  const maxOrder = await prisma.document.aggregate({
    where: {
      projectId: params.projectId,
      slateId: params.slateId,
      section: params.section,
    },
    _max: { order: true },
  });

  return prisma.document.create({
    data: {
      projectId: params.projectId,
      slateId: params.slateId,
      section: params.section,
      title: finalTitle,
      fileKey: params.fileKey,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      pageWidth: params.pageWidth ?? null,
      pageHeight: params.pageHeight ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}
