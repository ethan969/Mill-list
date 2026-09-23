import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { signRoomToken } from "@/lib/auth";

// End-to-end check that the proxy-level room gate (src/proxy.ts) actually
// stops an unauthenticated, expired, or session-version-revoked request
// before any room page, layout, or RSC flight payload can be produced —
// exercised against a real `next start` server rather than calling
// exported functions directly, since the bug this guards against
// (src/lib/require-room-access.ts) was specifically about response bodies
// a unit test of the page component alone would never see.

const PORT = 3311;
const BASE_URL = `http://localhost:${PORT}`;
const secretValue = process.env.SESSION_SECRET!;
const secret = new TextEncoder().encode(secretValue);

const ROOM_PATHS = [
  "/room",
  "/room/about",
  "/room/gallery",
  "/room/script",
  "/room/creative-deck",
  "/room/financials",
  "/room/production-plan",
];

async function signExpiredRoomToken(
  projectId: string,
  slug: string,
  sessionVersion: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ kind: "room", projectId, slug, sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 1000)
    .setExpirationTime(now - 500)
    .sign(secret);
}

function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = async () => {
      try {
        const res = await fetch(`${BASE_URL}/`);
        if (res.status > 0) {
          resolve();
          return;
        }
      } catch {
        // Not up yet — fall through to the retry/timeout check below.
      }
      if (Date.now() > deadline) {
        reject(new Error("next start did not become reachable in time"));
        return;
      }
      setTimeout(tryOnce, 300);
    };
    tryOnce();
  });
}

let server: ChildProcess | undefined;
let slug: string;
let projectId: string;
let secrets: string[];
let secretDocTitles: Record<string, string>;

beforeAll(async () => {
  slug = `room-gate-test-${crypto.randomUUID()}`;
  const rand = crypto.randomUUID();

  const secretAbout = `SECRET-ABOUT-${rand}`;
  const secretBio = `SECRET-BIO-${rand}`;
  const secretCaption = `SECRET-CAPTION-${rand}`;
  const secretReference = `SECRET-REFERENCE-${rand}`;
  secretDocTitles = {
    SCRIPT: `SECRET-SCRIPT-TITLE-${rand}`,
    CREATIVE_DECK: `SECRET-DECK-TITLE-${rand}`,
    FINANCIALS: `SECRET-FINANCIALS-TITLE-${rand}`,
    PRODUCTION_PLAN: `SECRET-PLAN-TITLE-${rand}`,
  };

  const project = await prisma.project.create({
    data: {
      slug,
      title: `Secret Project ${rand}`,
      productionCompany: "Secret Co",
      passwordHash: "unused-in-this-test",
      isPublished: true,
      aboutContent: secretAbout,
      aboutTeam: [{ name: "Jane Doe", role: "Director", bio: secretBio }],
    },
  });
  projectId = project.id;

  await prisma.document.createMany({
    data: Object.entries(secretDocTitles).map(([section, title]) => ({
      projectId,
      section: section as "SCRIPT" | "CREATIVE_DECK" | "FINANCIALS" | "PRODUCTION_PLAN",
      title,
      fileKey: `test/${rand}/${section}.pdf`,
    })),
  });

  await prisma.galleryItem.create({
    data: {
      projectId,
      type: "IMAGE",
      fileKey: `test/${rand}/gallery.jpg`,
      caption: secretCaption,
    },
  });

  await prisma.referenceLink.create({
    data: { projectId, label: secretReference, url: "https://example.com/secret" },
  });

  secrets = [secretAbout, secretBio, secretCaption, secretReference, ...Object.values(secretDocTitles)];

  // Build fresh so the server under test reflects the current source tree,
  // not a stale .next from some earlier, unrelated build.
  await new Promise<void>((resolve, reject) => {
    const build = spawn("npx", ["next", "build"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    build.on("error", reject);
    build.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`next build exited with code ${code}`))
    );
  });

  // `next start` spawns its own `next-server` child process; without
  // `detached: true` + killing the whole process group below, SIGKILL-ing
  // just this top-level PID leaves that grandchild running as an orphan.
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
    detached: true,
  });

  await waitForServer(30000);
}, 240000);

afterAll(async () => {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
});

describe("proxy room gate: every room route, three invalid-session states", () => {
  it("redirects every room route with no cookie, leaking nothing", async () => {
    for (const path of ROOM_PATHS) {
      const res = await fetch(`${BASE_URL}/${slug}${path}`, { redirect: "manual" });
      expect(res.status, `no cookie: ${path}`).toBe(307);
      expect(res.headers.get("location"), `no cookie redirect target: ${path}`).toBe(`/${slug}`);

      const body = await res.text();
      expect(body.length, `no cookie body size: ${path}`).toBeLessThan(200);
      for (const s of secrets) {
        expect(body, `no cookie leaked "${s}" on ${path}`).not.toContain(s);
      }
    }
  });

  it("redirects every room route with an expired cookie, leaking nothing", async () => {
    const token = await signExpiredRoomToken(projectId, slug, 1);
    for (const path of ROOM_PATHS) {
      const res = await fetch(`${BASE_URL}/${slug}${path}`, {
        redirect: "manual",
        headers: { cookie: `room_${slug}=${token}` },
      });
      expect(res.status, `expired cookie: ${path}`).toBe(307);
      expect(res.headers.get("location"), `expired cookie redirect target: ${path}`).toBe(`/${slug}`);

      const body = await res.text();
      expect(body.length, `expired cookie body size: ${path}`).toBeLessThan(200);
      for (const s of secrets) {
        expect(body, `expired cookie leaked "${s}" on ${path}`).not.toContain(s);
      }
    }
  });

  it("redirects every room route with a revoked-sessionVersion cookie, leaking nothing", async () => {
    // Signed while sessionVersion was 1, then the project is bumped to 2 —
    // simulates a password change or an explicit "revoke sessions" click
    // happening after this cookie was already issued to a viewer.
    const staleToken = await signRoomToken(projectId, slug, 1);
    await prisma.project.update({
      where: { id: projectId },
      data: { sessionVersion: { increment: 1 } },
    });

    for (const path of ROOM_PATHS) {
      const res = await fetch(`${BASE_URL}/${slug}${path}`, {
        redirect: "manual",
        headers: { cookie: `room_${slug}=${staleToken}` },
      });
      expect(res.status, `revoked cookie: ${path}`).toBe(307);
      expect(res.headers.get("location"), `revoked cookie redirect target: ${path}`).toBe(`/${slug}`);

      const body = await res.text();
      expect(body.length, `revoked cookie body size: ${path}`).toBeLessThan(200);
      for (const s of secrets) {
        expect(body, `revoked cookie leaked "${s}" on ${path}`).not.toContain(s);
      }
    }
  });

  it("a Next.js RSC-payload-style request is gated identically to a normal navigation", async () => {
    const res = await fetch(`${BASE_URL}/${slug}/room/script`, {
      redirect: "manual",
      headers: { RSC: "1", "Next-Router-Prefetch": "1" },
    });
    expect(res.status).toBe(307);
    const body = await res.text();
    expect(body.length).toBeLessThan(200);
    for (const s of secrets) {
      expect(body).not.toContain(s);
    }
  });

  it("a valid, current-version cookie still reaches real authenticated content", async () => {
    const current = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const token = await signRoomToken(projectId, slug, current.sessionVersion);

    const res = await fetch(`${BASE_URL}/${slug}/room/script`, {
      redirect: "manual",
      headers: { cookie: `room_${slug}=${token}` },
    });
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toContain(secretDocTitles.SCRIPT);
  });
});
