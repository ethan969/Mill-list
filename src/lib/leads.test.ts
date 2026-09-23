import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/leads";

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("clientIp", () => {
  it("returns null when x-forwarded-for is absent", () => {
    expect(clientIp(requestWithHeaders({}))).toBeNull();
  });

  it("returns the single value when there's only one hop", () => {
    expect(clientIp(requestWithHeaders({ "x-forwarded-for": "203.0.113.5" }))).toBe(
      "203.0.113.5"
    );
  });

  it("returns the LAST entry, not the first, when there are multiple hops", () => {
    // Vercel's edge appends its own observed remote address as the last
    // hop — the earlier entries are whatever the client claimed.
    const header = "203.0.113.5, 198.51.100.9, 192.0.2.44";
    expect(clientIp(requestWithHeaders({ "x-forwarded-for": header }))).toBe(
      "192.0.2.44"
    );
  });

  it("is not fooled by a client claiming an arbitrary first entry", () => {
    // A malicious client can set x-forwarded-for on its own request, but
    // cannot control what Vercel's edge appends after it.
    const spoofedFirst = "1.2.3.4";
    const realLastHop = "9.9.9.9";
    const result = clientIp(
      requestWithHeaders({ "x-forwarded-for": `${spoofedFirst}, ${realLastHop}` })
    );
    expect(result).toBe(realLastHop);
    expect(result).not.toBe(spoofedFirst);
  });

  it("trims whitespace around the chosen entry", () => {
    expect(
      clientIp(requestWithHeaders({ "x-forwarded-for": "1.1.1.1,   2.2.2.2  " }))
    ).toBe("2.2.2.2");
  });

  it("ignores empty entries from a malformed header", () => {
    expect(clientIp(requestWithHeaders({ "x-forwarded-for": "1.1.1.1,," }))).toBe(
      "1.1.1.1"
    );
  });
});
