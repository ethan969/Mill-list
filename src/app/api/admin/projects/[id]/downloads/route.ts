import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const downloads = await prisma.documentDownload.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { document: { select: { title: true, section: true } } },
    take: 500,
  });

  return NextResponse.json({ downloads });
}
