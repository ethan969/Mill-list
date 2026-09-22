import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, buildAssetKey } from "@/lib/storage";
import { createGalleryItemRecord } from "@/lib/gallery";
import { GALLERY_MIME_TYPES, MAX_GALLERY_BYTES } from "@/lib/upload-limits";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const gallery = await prisma.galleryItem.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ gallery });
}

// Classic proxied upload — see the equivalent documents route for why this
// exists alongside presign/confirm (local-disk fallback + a size-capped
// fallback path).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const caption = form.get("caption");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!GALLERY_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type for gallery." },
      { status: 400 }
    );
  }
  if (file.size > MAX_GALLERY_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.floor(MAX_GALLERY_BYTES / 1024 / 1024)}MB).` },
      { status: 400 }
    );
  }

  const type = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildAssetKey(id, "gallery", randomUUID(), file.name);
  await putObject(key, buffer, file.type);

  const item = await createGalleryItemRecord({
    projectId: id,
    type,
    fileName: file.name,
    mimeType: file.type,
    caption: typeof caption === "string" ? caption : null,
    fileKey: key,
  });

  return NextResponse.json({ item }, { status: 201 });
}
