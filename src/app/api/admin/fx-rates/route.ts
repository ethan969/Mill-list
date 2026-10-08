import { NextRequest, NextResponse } from "next/server";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fxRateCreateSchema } from "@/lib/validation";

// FxRate.rate is a Prisma.Decimal — decimal.js defines toJSON(), so
// NextResponse.json's JSON.stringify serializes it to a plain decimal
// string with no further conversion needed here (unlike the BigInt
// minor-unit money columns elsewhere, which need an explicit Number()).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const rates = await prisma.fxRate.findMany({
    orderBy: [{ from: "asc" }, { to: "asc" }, { asOfDate: "desc" }],
  });
  return NextResponse.json({ rates });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = fxRateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid rate data." },
      { status: 400 }
    );
  }

  const asOfDate = new Date(parsed.data.asOfDate);
  if (Number.isNaN(asOfDate.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const rate = await prisma.fxRate.create({
    data: {
      from: parsed.data.from as Currency,
      to: parsed.data.to as Currency,
      rate: parsed.data.rate,
      asOfDate,
    },
  });

  return NextResponse.json({ rate }, { status: 201 });
}
