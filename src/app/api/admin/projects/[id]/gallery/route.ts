import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, buildAssetKey } from "@/lib/storage";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

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
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type for gallery." },
      { status: 400 }
    );
  }

  const type = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";

  const maxOrder = await prisma.galleryItem.aggregate({
    where: { projectId: id },
    _max: { order: true },
  });

  const item = await prisma.galleryItem.create({
    data: {
      projectId: id,
      type,
      fileKey: "",
      fileName: file.name,
      mimeType: file.type,
      caption: typeof caption === "string" && caption ? caption : null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildAssetKey(id, "gallery", item.id, file.name);
  await putObject(key, buffer, file.type);

  const updated = await prisma.galleryItem.update({
    where: { id: item.id },
    data: { fileKey: key },
  });

  return NextResponse.json({ item: updated }, { status: 201 });
}
