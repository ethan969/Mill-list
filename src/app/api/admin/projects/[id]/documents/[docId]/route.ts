import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteObject } from "@/lib/storage";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  order: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, docId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id: docId, projectId: id },
  });
  if (!document) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const updated = await prisma.document.update({
    where: { id: docId },
    data: parsed.data,
  });

  return NextResponse.json({ document: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, docId } = await params;
  const document = await prisma.document.findFirst({
    where: { id: docId, projectId: id },
  });
  if (!document) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.document.delete({ where: { id: docId } });
  await deleteObject(document.fileKey).catch(() => {});

  return NextResponse.json({ ok: true });
}
