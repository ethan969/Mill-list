import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createRoomSession } from "@/lib/auth";
import { checkRateLimit, recordAttempt, clearAttempts } from "@/lib/rate-limit";
import { clientIp } from "@/lib/leads";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = clientIp(request) ?? "unknown";
  const rateKey = `room:${slug}:${ip}`;

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

  const project = await prisma.project.findUnique({ where: { slug } });

  if (!project || !project.isPublished) {
    await recordAttempt(rateKey);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, project.passwordHash);
  if (!valid) {
    await recordAttempt(rateKey);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await clearAttempts(rateKey);
  await createRoomSession(project.id, project.slug, project.sessionVersion);

  return NextResponse.json({ ok: true });
}
