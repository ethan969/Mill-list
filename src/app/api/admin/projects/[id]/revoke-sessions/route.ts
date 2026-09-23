import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Invalidates every currently-issued room session cookie for this project
// (e.g. a leaked link, an offboarded collaborator) without changing the
// password — bumps Project.sessionVersion, which every room JWT is
// checked against on each request (see verifyRoomToken in src/lib/auth.ts).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.update({
    where: { id },
    data: { sessionVersion: { increment: 1 } },
  });

  return NextResponse.json({ project });
}
