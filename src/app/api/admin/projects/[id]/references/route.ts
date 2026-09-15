import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { referenceLinkSchema } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const references = await prisma.referenceLink.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ references });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = referenceLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid link." },
      { status: 400 }
    );
  }

  const maxOrder = await prisma.referenceLink.aggregate({
    where: { projectId: id },
    _max: { order: true },
  });

  const reference = await prisma.referenceLink.create({
    data: {
      projectId: id,
      label: parsed.data.label,
      url: parsed.data.url,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ reference }, { status: 201 });
}
