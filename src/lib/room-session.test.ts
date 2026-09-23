import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signRoomToken, verifyRoomToken } from "@/lib/auth";

describe("room session versioning", () => {
  let projectId: string;
  let slug: string;

  beforeEach(async () => {
    slug = `room-session-test-${crypto.randomUUID()}`;
    const project = await prisma.project.create({
      data: {
        slug,
        title: "Test Project",
        productionCompany: "Test Co",
        passwordHash: "unused-in-this-test",
      },
    });
    projectId = project.id;
  });

  afterEach(async () => {
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  });

  it("accepts a token signed with the project's current sessionVersion", async () => {
    const token = await signRoomToken(projectId, slug, 1);
    const payload = await verifyRoomToken(token, slug);
    expect(payload).not.toBeNull();
    expect(payload?.projectId).toBe(projectId);
  });

  it("rejects an old cookie after the password changes (sessionVersion bumped)", async () => {
    const token = await signRoomToken(projectId, slug, 1);
    expect(await verifyRoomToken(token, slug)).not.toBeNull();

    // Simulates what the password-change route does.
    await prisma.project.update({
      where: { id: projectId },
      data: { sessionVersion: { increment: 1 } },
    });

    expect(await verifyRoomToken(token, slug)).toBeNull();
  });

  it("rejects an old cookie after an explicit revoke, even with the same password", async () => {
    const token = await signRoomToken(projectId, slug, 1);

    // Simulates the "Revoke all viewer sessions" button.
    await prisma.project.update({
      where: { id: projectId },
      data: { sessionVersion: { increment: 1 } },
    });

    expect(await verifyRoomToken(token, slug)).toBeNull();
  });

  it("accepts a freshly signed token after the version bump", async () => {
    await prisma.project.update({
      where: { id: projectId },
      data: { sessionVersion: { increment: 1 } },
    });
    const updated = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });

    const freshToken = await signRoomToken(projectId, slug, updated.sessionVersion);
    const payload = await verifyRoomToken(freshToken, slug);
    expect(payload).not.toBeNull();
    expect(payload?.sessionVersion).toBe(updated.sessionVersion);
  });

  it("rejects a token for the wrong slug", async () => {
    const token = await signRoomToken(projectId, slug, 1);
    expect(await verifyRoomToken(token, "some-other-slug")).toBeNull();
  });

  it("rejects a garbage token", async () => {
    expect(await verifyRoomToken("not-a-real-token", slug)).toBeNull();
  });

  it("multiple revokes each invalidate the previously-current token", async () => {
    const tokenV1 = await signRoomToken(projectId, slug, 1);
    await prisma.project.update({
      where: { id: projectId },
      data: { sessionVersion: { increment: 1 } },
    });
    const tokenV2 = await signRoomToken(projectId, slug, 2);
    expect(await verifyRoomToken(tokenV1, slug)).toBeNull();
    expect(await verifyRoomToken(tokenV2, slug)).not.toBeNull();

    await prisma.project.update({
      where: { id: projectId },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(await verifyRoomToken(tokenV2, slug)).toBeNull();
  });
});
