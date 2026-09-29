import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildSlateAssetKey, getPresignedUploadUrl, isCloudStorageConfigured } from "@/lib/storage";
import { DOCUMENT_SECTIONS } from "@/lib/sections";
import { DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/upload-limits";
import type { DocumentSection } from "@prisma/client";

const SECTION_KEYS = new Set(DOCUMENT_SECTIONS.map((s) => s.key));

// Mirrors POST /api/admin/projects/[id]/documents/presign — see that route
// for the large-file upload path this is step 1 of.
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
  const slate = await prisma.slate.findUnique({ where: { id } });
  if (!slate) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const fileName = body?.fileName;
  const contentType = body?.contentType;
  const section = body?.section;
  const fileSize = Number(body?.fileSize);

  if (typeof fileName !== "string" || !fileName) {
    return NextResponse.json({ error: "Missing file name." }, { status: 400 });
  }
  if (typeof section !== "string" || !SECTION_KEYS.has(section as DocumentSection)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }
  if (typeof contentType !== "string" || !DOCUMENT_MIME_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Documents must be uploaded as PDF for the flick-through viewer and watermarking to work." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.floor(MAX_DOCUMENT_BYTES / 1024 / 1024)}MB).` },
      { status: 400 }
    );
  }

  const key = buildSlateAssetKey(id, "documents", randomUUID(), fileName);
  const uploadUrl = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
