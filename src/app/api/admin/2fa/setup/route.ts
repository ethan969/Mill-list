import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getPendingTwoFactorSession } from "@/lib/auth";
import { generateTotpSecret, buildTotpUri, encryptTotpSecret, decryptTotpSecret } from "@/lib/totp";

// Requires a pending-2FA session (issued right after a correct password),
// not a full user session — this is how a user enrolls in 2FA for the
// first time, before they have one.
export async function GET() {
  const pending = await getPendingTwoFactorSession();
  if (!pending) {
    return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: pending.sub } });
  if (!user) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (user.totpEnabledAt) {
    return NextResponse.json({ error: "2FA is already enabled." }, { status: 400 });
  }

  let secret: string;
  if (user.totpSecretEncrypted) {
    // Reuse the still-unconfirmed secret so reloading this page doesn't
    // invalidate a QR code the user already scanned into their app.
    secret = decryptTotpSecret(user.totpSecretEncrypted);
  } else {
    secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecretEncrypted: encryptTotpSecret(secret) },
    });
  }

  const uri = buildTotpUri(secret, user.email);
  const qrDataUrl = await QRCode.toDataURL(uri);

  return NextResponse.json({ secret, qrDataUrl });
}
