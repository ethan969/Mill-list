import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, deleteObject, buildAssetKey } from "@/lib/storage";

const ALLOWED = ["image/png", "image/webp", "image/svg+xml"];

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
      { error: "Logo must be a PNG, WebP or SVG image (ideally transparent)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildAssetKey(project.id, "logo", "logo", file.name || "logo.png");
  await putObject(key, buffer, file.type);

  if (project.logoKey && project.logoKey !== key) {
    await deleteObject(project.logoKey).catch(() => {});
  }

  const updated = await prisma.project.update({
    where: { id },
    data: { logoKey: key, logoMimeType: file.type },
  });

  return NextResponse.json({ project: updated });
}
