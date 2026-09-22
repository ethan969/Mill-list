import "server-only";
import { prisma } from "@/lib/db";
import type { GalleryItemType } from "@prisma/client";

export async function createGalleryItemRecord(params: {
  projectId: string;
  type: GalleryItemType;
  fileName: string;
  mimeType: string;
  caption?: string | null;
  fileKey: string;
}) {
  const maxOrder = await prisma.galleryItem.aggregate({
    where: { projectId: params.projectId },
    _max: { order: true },
  });

  return prisma.galleryItem.create({
    data: {
      projectId: params.projectId,
      type: params.type,
      fileKey: params.fileKey,
      fileName: params.fileName,
      mimeType: params.mimeType,
      caption: params.caption || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}
