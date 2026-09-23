import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getPendingTwoFactorSession,
  destroyPendingTwoFactorSession,
  createAdminSession,
} from "@/lib/auth";
import { decryptTotpSecret, verifyAndConsumeTotp, consumeRecoveryCode } from "@/lib/totp";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";
import { clientIp } from "@/lib/leads";

// Second step of login for an admin already enrolled in 2FA: a TOTP code,
// or a recovery code if they've lost access to their authenticator.
export async function POST(request: NextRequest) {
  const pending = await getPendingTwoFactorSession();
  if (!pending) {
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const rateKey = `2fa-verify:${pending.sub}:${ip}`;
  const rate = await checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const recoveryCode = typeof body?.recoveryCode === "string" ? body.recoveryCode.trim() : "";
  if (!code && !recoveryCode) {
    return NextResponse.json({ error: "Enter a code." }, { status: 400 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.sub } });
  if (!admin || !admin.totpEnabledAt || !admin.totpSecretEncrypted) {
    return NextResponse.json({ error: "2FA isn't set up for this account." }, { status: 400 });
  }

  let ok = false;
  if (recoveryCode) {
    ok = await consumeRecoveryCode(admin.id, recoveryCode);
  } else {
    const secret = decryptTotpSecret(admin.totpSecretEncrypted);
    const result = verifyAndConsumeTotp(secret, code, admin.totpLastUsedStep);
    if (result.valid) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { totpLastUsedStep: result.step },
      });
      ok = true;
    }
  }

  if (!ok) {
    await recordAttempt(rateKey);
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }

  await destroyPendingTwoFactorSession();
  await createAdminSession(admin.id, admin.email);

  return NextResponse.json({ ok: true });
}
