import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildAssetKey, getPresignedUploadUrl, isCloudStorageConfigured } from "@/lib/storage";
import { GALLERY_MIME_TYPES, MAX_GALLERY_BYTES } from "@/lib/upload-limits";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!isCloudStorageConfigured) {
    return NextResponse.json(
      { error: "not_configured", message: "Cloud storage isn't configured." },
      { status: 501 }
    );
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const fileName = body?.fileName;
  const contentType = body?.contentType;
  const fileSize = Number(body?.fileSize);

  if (typeof fileName !== "string" || !fileName) {
    return NextResponse.json({ error: "Missing file name." }, { status: 400 });
  }
  if (typeof contentType !== "string" || !GALLERY_MIME_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Unsupported file type for gallery." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_GALLERY_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.floor(MAX_GALLERY_BYTES / 1024 / 1024)}MB).` },
      { status: 400 }
    );
  }

  const key = buildAssetKey(id, "gallery", randomUUID(), fileName);
  const uploadUrl = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
