import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { headObject } from "@/lib/storage";
import { createGalleryItemRecord } from "@/lib/gallery";
import { GALLERY_MIME_TYPES } from "@/lib/upload-limits";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const key = body?.key;
  const caption = body?.caption;
  const fileName = body?.fileName;
  const contentType = body?.contentType;

  if (typeof key !== "string" || !key.startsWith(`projects/${id}/gallery/`)) {
    return NextResponse.json({ error: "Invalid upload reference." }, { status: 400 });
  }
  if (typeof contentType !== "string" || !GALLERY_MIME_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Invalid file type." }, { status: 400 });
  }
  if (typeof fileName !== "string" || !fileName) {
    return NextResponse.json({ error: "Missing file name." }, { status: 400 });
  }

  const stat = await headObject(key);
  if (!stat) {
    return NextResponse.json(
      { error: "Upload didn't complete — the file wasn't found in storage." },
      { status: 400 }
    );
  }

  const type = contentType.startsWith("video/") ? "VIDEO" : "IMAGE";

  const item = await createGalleryItemRecord({
    projectId: id,
    type,
    fileName,
    mimeType: contentType,
    caption: typeof caption === "string" ? caption : null,
    fileKey: key,
  });

  return NextResponse.json({ item }, { status: 201 });
}
