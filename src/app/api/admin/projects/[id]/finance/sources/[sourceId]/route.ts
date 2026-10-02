import { NextRequest, NextResponse } from "next/server";
import type { FinanceSourceType, FinanceSourceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { financeSourceUpdateSchema } from "@/lib/validation";
import { bigIntMinorToNumber, parseMoneyMajorToMinor } from "@/lib/money";

function serializeSource<T extends { amount: bigint }>(source: T) {
  return { ...source, amount: bigIntMinorToNumber(source.amount) };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, sourceId } = await params;
  const existing = await prisma.financeSource.findUnique({
    where: { id: sourceId },
    select: { id: true, projectId: true },
  });
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = financeSourceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid source data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  let amountMinor: number | null = null;
  if (data.amount !== undefined) {
    amountMinor = parseMoneyMajorToMinor(data.amount);
    if (amountMinor === null) {
      return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
    }
  }

  const [source] = await prisma.$transaction([
    prisma.financeSource.update({
      where: { id: sourceId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined
          ? { type: data.type as FinanceSourceType }
          : {}),
        ...(amountMinor !== null ? { amount: BigInt(amountMinor) } : {}),
        ...(data.status !== undefined
          ? { status: data.status as FinanceSourceStatus }
          : {}),
        ...(data.recoups !== undefined ? { recoups: data.recoups } : {}),
        ...(data.recoupmentPosition !== undefined
          ? { recoupmentPosition: data.recoupmentPosition }
          : {}),
        ...(data.recoupmentPremiumBps !== undefined
          ? { recoupmentPremiumBps: data.recoupmentPremiumBps }
          : {}),
      },
    }),
    prisma.project.update({
      where: { id },
      data: { financeUpdatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ source: serializeSource(source) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id, sourceId } = await params;
  const existing = await prisma.financeSource.findUnique({
    where: { id: sourceId },
    select: { id: true, projectId: true },
  });
  if (!existing || existing.projectId !== id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.financeSource.delete({ where: { id: sourceId } }),
    prisma.project.update({
      where: { id },
      data: { financeUpdatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
