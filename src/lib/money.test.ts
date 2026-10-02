import { describe, expect, it } from "vitest";
import {
  bigIntMinorToNumber,
  formatMoneyMinorToMajor,
  parseMoneyMajorToMinor,
} from "@/lib/money";

describe("parseMoneyMajorToMinor", () => {
  it("parses a plain whole-pound amount", () => {
    expect(parseMoneyMajorToMinor("1250000")).toBe(125_000_000);
  });

  it("parses a two-decimal amount exactly, no float drift", () => {
    expect(parseMoneyMajorToMinor("10.10")).toBe(1010);
    expect(parseMoneyMajorToMinor("0.29")).toBe(29);
    expect(parseMoneyMajorToMinor("19.99")).toBe(1999);
  });

  it("pads a single decimal digit", () => {
    expect(parseMoneyMajorToMinor("10.1")).toBe(1010);
  });

  it("returns null for an empty string (caller's 'leave unset' case)", () => {
    expect(parseMoneyMajorToMinor("")).toBeNull();
    expect(parseMoneyMajorToMinor("   ")).toBeNull();
  });

  it("returns null for malformed input rather than guessing", () => {
    expect(parseMoneyMajorToMinor("abc")).toBeNull();
    expect(parseMoneyMajorToMinor("1.999")).toBeNull();
    expect(parseMoneyMajorToMinor("1,000")).toBeNull();
    expect(parseMoneyMajorToMinor("--5")).toBeNull();
  });

  it("handles negative amounts (e.g. a gap figure)", () => {
    expect(parseMoneyMajorToMinor("-500.50")).toBe(-50050);
  });

  it("handles zero", () => {
    expect(parseMoneyMajorToMinor("0")).toBe(0);
    expect(parseMoneyMajorToMinor("0.00")).toBe(0);
  });
});

describe("formatMoneyMinorToMajor", () => {
  it("round-trips through parseMoneyMajorToMinor", () => {
    for (const major of ["0.00", "10.10", "1250000.00", "19.99"]) {
      const minor = parseMoneyMajorToMinor(major)!;
      expect(formatMoneyMinorToMajor(minor)).toBe(major);
    }
  });

  it("formats a negative amount", () => {
    expect(formatMoneyMinorToMajor(-50050)).toBe("-500.50");
  });

  it("pads single-digit minor units", () => {
    expect(formatMoneyMinorToMajor(5)).toBe("0.05");
  });
});

describe("bigIntMinorToNumber", () => {
  it("converts a BigInt minor-unit column to a plain number", () => {
    expect(bigIntMinorToNumber(BigInt(125_000_00))).toBe(125_000_00);
  });

  it("passes through null (no budget entered)", () => {
    expect(bigIntMinorToNumber(null)).toBeNull();
  });
});
