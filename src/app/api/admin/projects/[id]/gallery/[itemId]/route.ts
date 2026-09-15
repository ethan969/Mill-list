import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteObject } from "@/lib/storage";
import { z } from "zod";

const updateSchema = z.object({
  caption: z.string().trim().max(300).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, itemId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const item = await prisma.galleryItem.findFirst({
    where: { id: itemId, projectId: id },
  });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const updated = await prisma.galleryItem.update({
    where: { id: itemId },
    data: parsed.data,
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, itemId } = await params;
  const item = await prisma.galleryItem.findFirst({
    where: { id: itemId, projectId: id },
  });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.galleryItem.delete({ where: { id: itemId } });
  await deleteObject(item.fileKey).catch(() => {});

  return NextResponse.json({ ok: true });
}
