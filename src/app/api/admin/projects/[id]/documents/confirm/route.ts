import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { headObject } from "@/lib/storage";
import { createDocumentRecord } from "@/lib/documents";
import { DOCUMENT_SECTIONS } from "@/lib/sections";
import { DOCUMENT_MIME_TYPES } from "@/lib/upload-limits";
import type { DocumentSection } from "@prisma/client";

const SECTION_KEYS = new Set(DOCUMENT_SECTIONS.map((s) => s.key));

// Step 2 of the large-file upload path: called once the browser's direct
// PUT to cloud storage (from the presign step) has succeeded, to record
// the document. Verifies the object actually exists rather than trusting
// the browser, and uses cloud storage's own reported size rather than a
// client-supplied number.
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
  const section = body?.section;
  const title = body?.title;
  const fileName = body?.fileName;
  const contentType = body?.contentType;

  if (typeof key !== "string" || !key.startsWith(`projects/${id}/documents/`)) {
    return NextResponse.json({ error: "Invalid upload reference." }, { status: 400 });
  }
  if (typeof section !== "string" || !SECTION_KEYS.has(section as DocumentSection)) {
    return NextResponse.json({ error: "Invalid section." }, { status: 400 });
  }
  if (typeof contentType !== "string" || !DOCUMENT_MIME_TYPES.has(contentType)) {
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

  const document = await createDocumentRecord({
    projectId: id,
    section: section as DocumentSection,
    title: typeof title === "string" ? title : null,
    fileName,
    mimeType: contentType,
    fileSize: stat.size,
    fileKey: key,
  });

  return NextResponse.json({ document }, { status: 201 });
}
