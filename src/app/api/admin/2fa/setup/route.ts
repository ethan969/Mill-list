import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getPendingTwoFactorSession } from "@/lib/auth";
import { generateTotpSecret, buildTotpUri, encryptTotpSecret, decryptTotpSecret } from "@/lib/totp";

// Requires a pending-2FA session (issued right after a correct password),
// not a full admin session — this is how an admin enrolls in 2FA for the
// first time, before they have one.
export async function GET() {
  const pending = await getPendingTwoFactorSession();
  if (!pending) {
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.sub } });
  if (!admin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (admin.totpEnabledAt) {
    return NextResponse.json({ error: "2FA is already enabled." }, { status: 400 });
  }

  let secret: string;
  if (admin.totpSecretEncrypted) {
    // Reuse the still-unconfirmed secret so reloading this page doesn't
    // invalidate a QR code the admin already scanned into their app.
    secret = decryptTotpSecret(admin.totpSecretEncrypted);
  } else {
    secret = generateTotpSecret();
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpSecretEncrypted: encryptTotpSecret(secret) },
    });
  }

  const uri = buildTotpUri(secret, admin.email);
  const qrDataUrl = await QRCode.toDataURL(uri);

  return NextResponse.json({ secret, qrDataUrl });
}
