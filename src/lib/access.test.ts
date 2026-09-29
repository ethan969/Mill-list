import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signRoomToken } from "@/lib/room-token";
import { signSlateToken } from "@/lib/slate-token";
import {
  canAccessProject,
  canAccessSlate,
  canAccessDocument,
} from "@/lib/access";
import { POST as slateAuth } from "@/app/api/slate/[slug]/auth/route";
import bcrypt from "bcryptjs";

function requestWithCookies(cookies: Record<string, string>): NextRequest {
  const entries = Object.entries(cookies).map(([name, value]) => ({ name, value }));
  return {
    cookies: { getAll: () => entries },
  } as unknown as NextRequest;
}

describe("access control: projects, slates, and slate-carried documents", () => {
  let projectA: { id: string; slug: string };
  let projectB: { id: string; slug: string }; // never a slate member
  let slateX: { id: string; slug: string };
  let slateY: { id: string; slug: string };
  let projectDoc: { id: string };
  let slateDoc: { id: string };

  beforeEach(async () => {
    const suffix = crypto.randomUUID();

    const pA = await prisma.project.create({
      data: {
        slug: `access-test-a-${suffix}`,
        title: "Project A",
        productionCompany: "Test Co",
        passwordHash: "unused-in-this-test",
      },
    });
    const pB = await prisma.project.create({
      data: {
        slug: `access-test-b-${suffix}`,
        title: "Project B",
        productionCompany: "Test Co",
        passwordHash: "unused-in-this-test",
      },
    });
    projectA = { id: pA.id, slug: pA.slug };
    projectB = { id: pB.id, slug: pB.slug };

    const sX = await prisma.slate.create({
      data: {
        slug: `access-test-slate-x-${suffix}`,
        title: "Slate X",
        passwordHash: await bcrypt.hash("slate-x-password", 4),
      },
    });
    const sY = await prisma.slate.create({
      data: {
        slug: `access-test-slate-y-${suffix}`,
        title: "Slate Y",
        passwordHash: await bcrypt.hash("slate-y-password", 4),
      },
    });
    slateX = { id: sX.id, slug: sX.slug };
    slateY = { id: sY.id, slug: sY.slug };

    await prisma.slateProject.create({
      data: { slateId: slateX.id, projectId: projectA.id },
    });

    const doc = await prisma.document.create({
      data: {
        projectId: projectA.id,
        section: "SCRIPT",
        title: "Project A script",
        fileKey: "unused",
      },
    });
    projectDoc = { id: doc.id };

    const sDoc = await prisma.document.create({
      data: {
        slateId: slateX.id,
        section: "SCRIPT",
        title: "Slate X overview",
        fileKey: "unused",
      },
    });
    slateDoc = { id: sDoc.id };
  });

  afterEach(async () => {
    await prisma.document.deleteMany({
      where: { id: { in: [projectDoc.id, slateDoc.id] } },
    });
    await prisma.slateProject.deleteMany({
      where: { slateId: { in: [slateX.id, slateY.id] } },
    });
    await prisma.slate.deleteMany({ where: { id: { in: [slateX.id, slateY.id] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectA.id, projectB.id] } } });
  });

  it("a slate cookie opens a member project", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: token });
    expect(await canAccessProject(request, projectA.id)).toBe(true);
  });

  it("a slate cookie is denied a non-member project", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: token });
    expect(await canAccessProject(request, projectB.id)).toBe(false);
  });

  it("is denied once the project is removed from the slate", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: token });
    expect(await canAccessProject(request, projectA.id)).toBe(true);

    await prisma.slateProject.delete({
      where: { slateId_projectId: { slateId: slateX.id, projectId: projectA.id } },
    });

    expect(await canAccessProject(request, projectA.id)).toBe(false);

    // Restore for the shared afterEach cleanup's own deleteMany to be a no-op either way.
    await prisma.slateProject.create({
      data: { slateId: slateX.id, projectId: projectA.id },
    });
  });

  it("is denied after an explicit slate revoke (sessionVersion bump)", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: token });
    expect(await canAccessProject(request, projectA.id)).toBe(true);

    await prisma.slate.update({
      where: { id: slateX.id },
      data: { sessionVersion: { increment: 1 } },
    });

    expect(await canAccessProject(request, projectA.id)).toBe(false);
  });

  it("is denied after a slate password change (same sessionVersion bump)", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: token });
    expect(await canAccessProject(request, projectA.id)).toBe(true);

    // What the password-change admin action does.
    await prisma.slate.update({
      where: { id: slateX.id },
      data: {
        passwordHash: await bcrypt.hash("a-new-password", 4),
        sessionVersion: { increment: 1 },
      },
    });

    expect(await canAccessProject(request, projectA.id)).toBe(false);
  });

  it("a project's own room cookie cannot open a slate-level document", async () => {
    const roomToken = await signRoomToken(projectA.id, projectA.slug, 1);
    const request = requestWithCookies({ [`room_${projectA.slug}`]: roomToken });
    expect(await canAccessDocument(request, slateDoc.id)).toBe(false);
  });

  it("a project's own room cookie still opens that project's own document", async () => {
    const roomToken = await signRoomToken(projectA.id, projectA.slug, 1);
    const request = requestWithCookies({ [`room_${projectA.slug}`]: roomToken });
    expect(await canAccessDocument(request, projectDoc.id)).toBe(true);
  });

  it("a slate cookie opens that slate's own slate-level document", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: token });
    expect(await canAccessDocument(request, slateDoc.id)).toBe(true);
  });

  it("a slate cookie opens a member project's document via canAccessDocument", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: token });
    expect(await canAccessDocument(request, projectDoc.id)).toBe(true);
  });

  it("slate A's cookie cannot open slate B", async () => {
    const tokenA = await signSlateToken(slateX.id, slateX.slug, 1);
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: tokenA });
    expect(await canAccessSlate(request, slateY.id)).toBe(false);
  });

  it("slate A's cookie cannot open slate B's slate-level document", async () => {
    const docB = await prisma.document.create({
      data: { slateId: slateY.id, section: "SCRIPT", title: "Slate Y doc", fileKey: "unused" },
    });
    try {
      const tokenA = await signSlateToken(slateX.id, slateX.slug, 1);
      const request = requestWithCookies({ [`slate_${slateX.slug}`]: tokenA });
      expect(await canAccessDocument(request, docB.id)).toBe(false);
    } finally {
      await prisma.document.delete({ where: { id: docB.id } });
    }
  });

  it("rejects an expired slate cookie", async () => {
    // signSlateToken always signs a fresh 7-day token — build an expired one
    // directly, same approach as the room-access integration test.
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({
      kind: "slate",
      slateId: slateX.id,
      slug: slateX.slug,
      sessionVersion: 1,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 1000)
      .setExpirationTime(now - 500)
      .sign(secret);

    const request = requestWithCookies({ [`slate_${slateX.slug}`]: expired });
    expect(await canAccessProject(request, projectA.id)).toBe(false);
  });

  it("rejects a tampered slate cookie", async () => {
    const token = await signSlateToken(slateX.id, slateX.slug, 1);
    const tampered = token.slice(0, -4) + "abcd";
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: tampered });
    expect(await canAccessProject(request, projectA.id)).toBe(false);
  });

  it("rejects a garbage cookie value outright", async () => {
    const request = requestWithCookies({ [`slate_${slateX.slug}`]: "not-a-real-token" });
    expect(await canAccessProject(request, projectA.id)).toBe(false);
  });

  describe("no enumeration difference on /api/slate/[slug]/auth", () => {
    function authRequest(slug: string, password: string): NextRequest {
      return new Request(`http://localhost/api/slate/${slug}/auth`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
        body: JSON.stringify({ password }),
      }) as unknown as NextRequest;
    }

    it("an unknown slate slug and a wrong password on a real slate return the identical response", async () => {
      const unknownRes = await slateAuth(authRequest("no-such-slate-anywhere", "whatever"), {
        params: Promise.resolve({ slug: "no-such-slate-anywhere" }),
      });
      const wrongPasswordRes = await slateAuth(authRequest(slateX.slug, "definitely-wrong"), {
        params: Promise.resolve({ slug: slateX.slug }),
      });

      expect(unknownRes.status).toBe(wrongPasswordRes.status);
      expect(await unknownRes.json()).toEqual(await wrongPasswordRes.json());
    });

    // The success path (correct password -> 200 + cookie set) isn't tested
    // here: createSlateSession() calls next/headers's cookies(), which
    // throws when invoked outside a real Next.js request scope — calling
    // the route handler directly, as above, only works for the
    // failure branches, which never reach that call. Covered instead by
    // src/room-access.integration.test.ts, which exercises this through a
    // real running server.
  });
});
