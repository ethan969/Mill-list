import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, buildAssetKey } from "@/lib/storage";
import { createDocumentRecord } from "@/lib/documents";
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
    where: { projectId: id },
    orderBy: [{ section: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ documents });
}

// Classic proxied upload — used for the local-disk storage fallback (dev),
// and as a fallback if cloud storage presigning isn't available. On a
// serverless host this is capped by the platform's request body limit
// (4.5MB on Vercel); large files must go through the presign/confirm pair
// instead, which uploads straight from the browser to cloud storage.
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
  const key = buildAssetKey(id, "documents", randomUUID(), file.name);
  await putObject(key, buffer, file.type);

  const document = await createDocumentRecord({
    projectId: id,
    section: section as DocumentSection,
    title: typeof title === "string" ? title : null,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    fileKey: key,
  });

  return NextResponse.json({ document }, { status: 201 });
}
