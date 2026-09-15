import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, deleteObject, buildAssetKey } from "@/lib/storage";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Poster must be a JPEG, PNG or WebP image." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildAssetKey(project.id, "poster", "poster", file.name || "poster.jpg");
  await putObject(key, buffer, file.type);

  if (project.posterKey && project.posterKey !== key) {
    await deleteObject(project.posterKey).catch(() => {});
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { posterKey: key, posterMimeType: file.type },
  });

  return NextResponse.json({ project: updated });
}
