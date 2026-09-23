import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getPendingTwoFactorSession,
  destroyPendingTwoFactorSession,
  createAdminSession,
} from "@/lib/auth";
import { decryptTotpSecret, verifyAndConsumeTotp, createRecoveryCodesForAdmin } from "@/lib/totp";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";
import { clientIp } from "@/lib/leads";

// Confirms first-time 2FA enrollment: the admin submits the code their
// authenticator app is now showing for the secret /2fa/setup gave them.
// On success, enables 2FA, issues recovery codes (shown once, here), and
// upgrades the pending session into a real one.
export async function POST(request: NextRequest) {
  const pending = await getPendingTwoFactorSession();
  if (!pending) {
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }

  const ip = clientIp(request) ?? "unknown";
  const rateKey = `2fa-confirm:${pending.sub}:${ip}`;
  const rate = await checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.sub } });
  if (!admin || !admin.totpSecretEncrypted || admin.totpEnabledAt) {
    return NextResponse.json({ error: "Nothing to confirm." }, { status: 400 });
  }

  const secret = decryptTotpSecret(admin.totpSecretEncrypted);
  const result = verifyAndConsumeTotp(secret, code, admin.totpLastUsedStep);
  if (!result.valid) {
    await recordAttempt(rateKey);
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { totpEnabledAt: new Date(), totpLastUsedStep: result.step },
  });
  const recoveryCodes = await createRecoveryCodesForAdmin(admin.id);

  await destroyPendingTwoFactorSession();
  await createAdminSession(admin.id, admin.email);

  return NextResponse.json({ ok: true, recoveryCodes });
}
