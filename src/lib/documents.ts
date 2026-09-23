import "server-only";
import { prisma } from "@/lib/db";
import type { DocumentSection } from "@prisma/client";

export async function createDocumentRecord(params: {
  projectId: string;
  section: DocumentSection;
  title?: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileKey: string;
  pageWidth?: number | null;
  pageHeight?: number | null;
}) {
  const finalTitle =
    params.title && params.title.trim().length > 0
      ? params.title.trim()
      : params.fileName.replace(/\.pdf$/i, "");

  const maxOrder = await prisma.document.aggregate({
    where: { projectId: params.projectId, section: params.section },
    _max: { order: true },
  });

  return prisma.document.create({
    data: {
      projectId: params.projectId,
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
