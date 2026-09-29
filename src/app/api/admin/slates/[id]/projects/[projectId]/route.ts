import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Removes a film from the slate. Existing slate cookie holders lose access
// to it on their very next request — membership is checked live against the
// database, never cached in the JWT (see resolveProjectAccess in
// src/lib/access.ts).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, projectId } = await params;
  const membership = await prisma.slateProject.findUnique({
    where: { slateId_projectId: { slateId: id, projectId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.slateProject.delete({
    where: { slateId_projectId: { slateId: id, projectId } },
  });

  return NextResponse.json({ ok: true });
}
