import { NextRequest, NextResponse } from "next/server";
import type { FinanceSourceType, FinanceSourceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  financeSourceCreateSchema,
  financeSourceReorderSchema,
} from "@/lib/validation";
import { bigIntMinorToNumber, parseMoneyMajorToMinor } from "@/lib/money";

function serializeSource<T extends { amount: bigint }>(source: T) {
  return { ...source, amount: bigIntMinorToNumber(source.amount) };
}

// One line item in this film's capital stack. Adding a source always
// touches the parent Project's financeUpdatedAt — the viewer's "last
// updated" date (src/app/slate/[slug]) reflects the sources table, not
// just the budget/currency fields on Project itself.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = financeSourceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid source data." },
      { status: 400 }
    );
  }

  const amountMinor = parseMoneyMajorToMinor(parsed.data.amount);
  if (amountMinor === null) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  const maxOrder = await prisma.financeSource.aggregate({
    where: { projectId: id },
    _max: { order: true },
  });

  const [source] = await prisma.$transaction([
    prisma.financeSource.create({
      data: {
        projectId: id,
        name: parsed.data.name,
        type: parsed.data.type as FinanceSourceType,
        amount: BigInt(amountMinor),
        status: parsed.data.status as FinanceSourceStatus,
        recoups: parsed.data.recoups ?? true,
        recoupmentPosition: parsed.data.recoupmentPosition ?? null,
        recoupmentPremiumBps: parsed.data.recoupmentPremiumBps ?? null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    }),
    prisma.project.update({
      where: { id },
      data: { financeUpdatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ source: serializeSource(source) }, { status: 201 });
}

// Reorders this film's finance sources. Body: { order: string[] } — an
// array of FinanceSource ids in the desired display order (same pattern
// as /api/admin/slates/[id]/projects's film reorder).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = financeSourceReorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const current = await prisma.financeSource.findMany({
    where: { projectId: id },
    select: { id: true },
  });
  const currentIds = new Set(current.map((c) => c.id));
  const requestedIds = new Set(parsed.data.order);
  if (
    currentIds.size !== requestedIds.size ||
    ![...currentIds].every((cid) => requestedIds.has(cid))
  ) {
    return NextResponse.json(
      { error: "The order must include exactly this film's current sources." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    ...parsed.data.order.map((sourceId, index) =>
      prisma.financeSource.update({
        where: { id: sourceId },
        data: { order: index },
      })
    ),
    prisma.project.update({
      where: { id },
      data: { financeUpdatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
