import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createAdminSession } from "@/lib/auth";
import { checkRateLimit, recordAttempt, clearAttempts } from "@/lib/rate-limit";
import { clientIp } from "@/lib/leads";

export async function POST(request: NextRequest) {
  const ip = clientIp(request) ?? "unknown";
  const rateKey = `admin-login:${ip}`;

  const rate = await checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 }
    );
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    await recordAttempt(rateKey);
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    await recordAttempt(rateKey);
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
  }

  await clearAttempts(rateKey);
  await createAdminSession(admin.id, admin.email);

  return NextResponse.json({ ok: true });
}
