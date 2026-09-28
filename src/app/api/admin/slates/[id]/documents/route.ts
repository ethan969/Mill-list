import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, buildSlateAssetKey } from "@/lib/storage";
import { createDocumentRecord } from "@/lib/documents";
import { getPdfPageSize } from "@/lib/pdf-dimensions";
import { DOCUMENT_SECTIONS } from "@/lib/sections";
import { DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/upload-limits";
import type { DocumentSection } from "@prisma/client";

const SECTION_KEYS = new Set(DOCUMENT_SECTIONS.map((s) => s.key));

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const documents = await prisma.document.findMany({
    where: { slateId: id },
    orderBy: [{ section: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ documents });
}

// Classic proxied upload — mirrors POST /api/admin/projects/[id]/documents;
// see that route for why this exists alongside the presign/confirm pair.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const slate = await prisma.slate.findUnique({ where: { id } });
  if (!slate) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const section = form.get("section");
  const title = form.get("title");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (typeof section !== "string" || !SECTION_KEYS.has(section as DocumentSection)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }
  if (!DOCUMENT_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Documents must be uploaded as PDF for the flick-through viewer and watermarking to work." },
      { status: 400 }
    );
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.floor(MAX_DOCUMENT_BYTES / 1024 / 1024)}MB).` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildSlateAssetKey(id, "documents", randomUUID(), file.name);
  await putObject(key, buffer, file.type);
  const pageSize = await getPdfPageSize(buffer);

  const document = await createDocumentRecord({
    slateId: id,
    section: section as DocumentSection,
    title: typeof title === "string" ? title : null,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    fileKey: key,
    pageWidth: pageSize?.width,
    pageHeight: pageSize?.height,
  });

  return NextResponse.json({ document }, { status: 201 });
}
