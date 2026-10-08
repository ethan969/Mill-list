/**
 * Converts between the major-unit decimal strings an admin types into a
 * form (e.g. "1250000.00") and the integer minor-unit amounts (e.g.
 * 125000000 pence) the database and src/lib/finance.ts work in — never via
 * a floating-point multiply, which could turn "10.10" into 1010.0000000001
 * minor units. Both directions only ever multiply/divide/combine integers
 * built from validated digit substrings.
 */

const MAJOR_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/**
 * Returns null for an empty string (the caller's "leave unset" case) or a
 * string that doesn't look like a plain decimal amount. Never throws.
 */
export function parseMoneyMajorToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!MAJOR_PATTERN.test(trimmed)) return null;

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole, frac = ""] = unsigned.split(".");
  const paddedFrac = (frac + "00").slice(0, 2);
  const minor = Number(whole) * 100 + Number(paddedFrac);
  return negative ? -minor : minor;
}

export function formatMoneyMinorToMajor(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${negative ? "-" : ""}${whole}.${String(frac).padStart(2, "0")}`;
}

/** Converts a Prisma BigInt minor-unit column to a plain number for JSON responses — see schema.prisma's Project.grossBudget comment for why this is always safe. */
export function bigIntMinorToNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}
