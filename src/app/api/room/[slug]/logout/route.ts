import { NextRequest, NextResponse } from "next/server";
import { destroyRoomSession } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  await destroyRoomSession(slug);
  return NextResponse.json({ ok: true });
}
