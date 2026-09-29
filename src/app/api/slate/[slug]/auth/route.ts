import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSlateSession } from "@/lib/auth";
import { checkRateLimit, recordAttempt, clearAttempts } from "@/lib/rate-limit";
import { clientIp } from "@/lib/leads";

// Mirrors /api/room/[slug]/auth exactly: same rate-limit key shape
// (slate:<slug>:<ip>), same bcrypt check, and the same no-enumeration
// behavior — an unknown slug and a wrong password both record an attempt
// and return the identical "Incorrect password." message, so a visitor
// (or an attacker) can't tell the two apart.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = clientIp(request) ?? "unknown";
  const rateKey = `slate:${slug}:${ip}`;

  const rate = await checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Enter the password." }, { status: 400 });
  }

  const slate = await prisma.slate.findUnique({ where: { slug } });

  if (!slate || !slate.isPublished) {
    await recordAttempt(rateKey);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, slate.passwordHash);
  if (!valid) {
    await recordAttempt(rateKey);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await clearAttempts(rateKey);
  await createSlateSession(slate.id, slate.slug, slate.sessionVersion);

  return NextResponse.json({ ok: true });
}
