import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Invalidates every currently-issued slate session cookie for this slate
// without changing the password — bumps Slate.sessionVersion, which every
// slate JWT is checked against on each request (see verifySlateToken in
// src/lib/slate-token.ts). Mirrors the project revoke-sessions route.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const slate = await prisma.slate.update({
    where: { id },
    data: { sessionVersion: { increment: 1 } },
  });

  return NextResponse.json({ slate });
}
