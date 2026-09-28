import crypto from "crypto";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import { prisma } from "@/lib/db";

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const ALGORITHM = "SHA1"; // widest authenticator-app compatibility
const VALIDATE_WINDOW = 1; // +/- one 30s step, to tolerate clock drift

// ---- Secret generation & the otpauth:// URI for the QR code ----

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function buildTotpUri(secret: string, accountEmail: string): string {
  const totp = new TOTP({
    issuer: "Mill List",
    label: accountEmail,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD_SECONDS,
    secret: Secret.fromBase32(secret),
  });
  return totp.toString();
}

// ---- Code verification, with replay protection ----

export type TotpCheck = { valid: true; step: number } | { valid: false };

/**
 * Verifies a submitted code against the secret, and — separately from
 * otpauth's own cryptographic check — rejects it if its time-step has
 * already been consumed. A bare TOTP.validate() call alone would accept
 * the same still-within-its-30s-window code twice; `lastUsedStep` is
 * whatever was last returned here as `step`, persisted by the caller
 * (AdminUser.totpLastUsedStep) so a captured code can't be replayed.
 */
export function verifyAndConsumeTotp(
  secret: string,
  token: string,
  lastUsedStep: number | null,
  timestamp: number = Date.now()
): TotpCheck {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return { valid: false };

  const delta = TOTP.validate({
    token: cleaned,
    secret: Secret.fromBase32(secret),
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD_SECONDS,
    timestamp,
    window: VALIDATE_WINDOW,
  });
  if (delta === null) return { valid: false };

  const step = Math.floor(timestamp / 1000 / PERIOD_SECONDS) + delta;
  if (lastUsedStep !== null && step <= lastUsedStep) return { valid: false };

  return { valid: true, step };
}

// ---- Encrypting the stored secret (AES-256-GCM, key from env) ----

function getEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY must be set to a base64-encoded 32-byte key (see .env.example)."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY must decode (from base64) to exactly 32 bytes."
    );
  }
  return key;
}

export function encryptTotpSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM's recommended IV size
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

export function decryptTotpSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted TOTP secret.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// ---- Recovery codes ----

const RECOVERY_CODE_COUNT = 10;

/** e.g. "7F3K-9QXZ" — short enough to type, long enough not to guess. */
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, generateRecoveryCode);
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(code.trim().toUpperCase(), 12);
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code.trim().toUpperCase(), hash);
}

/** Generates, hashes and stores a fresh set of recovery codes, returning the plaintext codes to show the admin once. */
export async function createRecoveryCodesForAdmin(adminId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await prisma.adminRecoveryCode.createMany({
    data: await Promise.all(
      codes.map(async (code) => ({ adminId, codeHash: await hashRecoveryCode(code) }))
    ),
  });
  return codes;
}

/**
 * Checks a submitted recovery code against an admin's unused codes and, on
 * a match, atomically marks it used — the `usedAt: null` guard in the
 * update's WHERE means a concurrent request racing to consume the exact
 * same code can't both succeed.
 */
export async function consumeRecoveryCode(
  adminId: string,
  submitted: string
): Promise<boolean> {
  const unused = await prisma.adminRecoveryCode.findMany({
    where: { adminId, usedAt: null },
  });
  for (const row of unused) {
    if (await verifyRecoveryCode(submitted, row.codeHash)) {
      const result = await prisma.adminRecoveryCode.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return result.count === 1;
    }
  }
  return false;
}
