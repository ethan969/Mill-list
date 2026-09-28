import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const addSchema = z.object({ projectId: z.string().min(1) });
const reorderSchema = z.object({ order: z.array(z.string().min(1)).min(1) });

// Adds a film to the slate. Membership (SlateProject) is what
// canAccessProject/canAccessDocument check live on every request — see
// src/lib/access.ts — so this takes effect for existing slate cookie
// holders immediately, with no re-login required.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const slate = await prisma.slate.findUnique({ where: { id } });
  if (!slate) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "That project doesn't exist." }, { status: 404 });
  }

  const existing = await prisma.slateProject.findUnique({
    where: {
      slateId_projectId: { slateId: id, projectId: project.id },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "That film is already in this slate." },
      { status: 409 }
    );
  }

  const maxOrder = await prisma.slateProject.aggregate({
    where: { slateId: id },
    _max: { order: true },
  });

  const membership = await prisma.slateProject.create({
    data: {
      slateId: id,
      projectId: project.id,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      project: { select: { id: true, slug: true, title: true, productionCompany: true } },
    },
  });

  return NextResponse.json({ membership }, { status: 201 });
}

// Reorders the slate's films. Body: { order: string[] } — an array of
// projectIds in the desired display order.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const current = await prisma.slateProject.findMany({
    where: { slateId: id },
    select: { projectId: true },
  });
  const currentIds = new Set(current.map((c) => c.projectId));
  const requestedIds = new Set(parsed.data.order);
  if (
    currentIds.size !== requestedIds.size ||
    ![...currentIds].every((pid) => requestedIds.has(pid))
  ) {
    return NextResponse.json(
      { error: "The order must include exactly this slate's current films." },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.order.map((projectId, index) =>
      prisma.slateProject.update({
        where: { slateId_projectId: { slateId: id, projectId } },
        data: { order: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
