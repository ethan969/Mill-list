import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, buildAssetKey } from "@/lib/storage";
import { DOCUMENT_SECTIONS } from "@/lib/sections";
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
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Documents must be uploaded as PDF for the flick-through viewer and watermarking to work." },
      { status: 400 }
    );
  }

  const finalTitle =
    typeof title === "string" && title.trim().length > 0
      ? title.trim()
      : file.name.replace(/\.pdf$/i, "");

  const maxOrder = await prisma.document.aggregate({
    where: { projectId: id, section: section as DocumentSection },
    _max: { order: true },
  });

  const document = await prisma.document.create({
    data: {
      projectId: id,
      section: section as DocumentSection,
      title: finalTitle,
      fileKey: "",
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildAssetKey(id, "documents", document.id, file.name);
  await putObject(key, buffer, file.type);

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: { fileKey: key },
  });

  return NextResponse.json({ document: updated }, { status: 201 });
}
