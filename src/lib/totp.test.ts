import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOTP, Secret } from "otpauth";
import { prisma } from "@/lib/db";
import {
  generateTotpSecret,
  buildTotpUri,
  verifyAndConsumeTotp,
  encryptTotpSecret,
  decryptTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  createRecoveryCodesForAdmin,
  consumeRecoveryCode,
} from "@/lib/totp";

const PERIOD = 30;

function codeAt(secret: string, timestamp: number): string {
  return TOTP.generate({
    secret: Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD,
    timestamp,
  });
}

describe("TOTP secret & URI", () => {
  it("generates a base32 secret usable in an otpauth URI", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    const uri = buildTotpUri(secret, "admin@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(encodeURIComponent("admin@example.com"));
  });
});

describe("encryptTotpSecret / decryptTotpSecret", () => {
  it("round-trips a secret", () => {
    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toBe(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const secret = generateTotpSecret();
    expect(encryptTotpSecret(secret)).not.toBe(encryptTotpSecret(secret));
  });

  it("fails to decrypt if the ciphertext was tampered with", () => {
    const encrypted = encryptTotpSecret(generateTotpSecret());
    const [iv, tag] = encrypted.split(":");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(":");
    expect(() => decryptTotpSecret(tampered)).toThrow();
  });
});

describe("verifyAndConsumeTotp", () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000; // fixed reference timestamp

  it("accepts a valid, current code", () => {
    const code = codeAt(secret, now);
    const result = verifyAndConsumeTotp(secret, code, null, now);
    expect(result.valid).toBe(true);
  });

  it("rejects a wrong code", () => {
    const result = verifyAndConsumeTotp(secret, "000000", null, now);
    expect(result.valid).toBe(false);
  });

  it("rejects a non-numeric or malformed code", () => {
    expect(verifyAndConsumeTotp(secret, "abcdef", null, now).valid).toBe(false);
    expect(verifyAndConsumeTotp(secret, "123", null, now).valid).toBe(false);
  });

  it("rejects an expired code (well outside the validity window)", () => {
    const oldCode = codeAt(secret, now - 10 * PERIOD * 1000); // 10 steps ago
    const result = verifyAndConsumeTotp(secret, oldCode, null, now);
    expect(result.valid).toBe(false);
  });

  it("rejects a reused code (same time-step submitted twice)", () => {
    const code = codeAt(secret, now);
    const first = verifyAndConsumeTotp(secret, code, null, now);
    expect(first.valid).toBe(true);
    if (!first.valid) throw new Error("unreachable");

    const second = verifyAndConsumeTotp(secret, code, first.step, now);
    expect(second.valid).toBe(false);
  });

  it("accepts a new code in a later step after one was consumed", () => {
    const first = verifyAndConsumeTotp(secret, codeAt(secret, now), null, now);
    expect(first.valid).toBe(true);
    if (!first.valid) throw new Error("unreachable");

    const later = now + PERIOD * 1000;
    const second = verifyAndConsumeTotp(secret, codeAt(secret, later), first.step, later);
    expect(second.valid).toBe(true);
  });
});

describe("recovery codes: generation & hashing", () => {
  it("generates 10 unique-looking codes by default", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("hashes a code and verifies it back, case/whitespace-insensitively", async () => {
    const hash = await hashRecoveryCode("ABCD-1234");
    expect(await verifyRecoveryCode("abcd-1234", hash)).toBe(true);
    expect(await verifyRecoveryCode("  ABCD-1234  ", hash)).toBe(true);
    expect(await verifyRecoveryCode("ABCD-9999", hash)).toBe(false);
  });
});

describe("recovery codes: single-use against the database", () => {
  let adminId: string;

  beforeEach(async () => {
    const admin = await prisma.adminUser.create({
      data: {
        email: `totp-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "unused-in-this-test",
      },
    });
    adminId = admin.id;
  });

  afterEach(async () => {
    await prisma.adminUser.delete({ where: { id: adminId } }).catch(() => {});
  });

  it("a freshly created code works exactly once", async () => {
    const codes = await createRecoveryCodesForAdmin(adminId);
    expect(codes).toHaveLength(10);

    const [code] = codes;
    expect(await consumeRecoveryCode(adminId, code!)).toBe(true);
    expect(await consumeRecoveryCode(adminId, code!)).toBe(false);
  });

  it("an unknown code is rejected", async () => {
    await createRecoveryCodesForAdmin(adminId);
    expect(await consumeRecoveryCode(adminId, "ZZZZ-ZZZZ")).toBe(false);
  });

  it("other codes in the set remain usable after one is spent", async () => {
    const codes = await createRecoveryCodesForAdmin(adminId);
    expect(await consumeRecoveryCode(adminId, codes[0]!)).toBe(true);
    expect(await consumeRecoveryCode(adminId, codes[1]!)).toBe(true);
    expect(await consumeRecoveryCode(adminId, codes[0]!)).toBe(false);
  });
});
