import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; refId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, refId } = await params;
  const reference = await prisma.referenceLink.findFirst({
    where: { id: refId, projectId: id },
  });
  if (!reference) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.referenceLink.delete({ where: { id: refId } });
  return NextResponse.json({ ok: true });
}
