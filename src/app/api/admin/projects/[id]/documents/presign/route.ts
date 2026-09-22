import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildAssetKey, getPresignedUploadUrl, isCloudStorageConfigured } from "@/lib/storage";
import { DOCUMENT_SECTIONS } from "@/lib/sections";
import { DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/upload-limits";
import type { DocumentSection } from "@prisma/client";

const SECTION_KEYS = new Set(DOCUMENT_SECTIONS.map((s) => s.key));

// Step 1 of the large-file upload path: hands the browser a short-lived,
// single-object URL it can PUT the file to directly on cloud storage,
// bypassing our server (and its platform request-size limit) entirely.
// Returns 501 when only the local-disk fallback is configured, since that
// has no equivalent — callers should fall back to the classic proxied
// upload route in that case.
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

  const key = buildAssetKey(id, "documents", randomUUID(), fileName);
  const uploadUrl = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
