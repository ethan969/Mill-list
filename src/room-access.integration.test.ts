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
let slateId: string;
let slateSlug: string;
let nonMemberProjectId: string;
let nonMemberSlug: string;
let secretLogline: string;
let secretTeamMemberName: string;
let projectTitle: string;
let otherSlateId: string;
let otherSlateSlug: string;
const SLATE_PASSWORD = "slate-integration-test-password";
const OTHER_SLATE_PASSWORD = "other-slate-integration-test-password";

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

  secretLogline = `SECRET-LOGLINE-${rand}`;
  secretTeamMemberName = `Jane Doe ${rand}`;
  projectTitle = `Secret Project ${rand}`;

  const project = await prisma.project.create({
    data: {
      slug,
      title: projectTitle,
      productionCompany: "Secret Co",
      passwordHash: "unused-in-this-test",
      isPublished: true,
      aboutContent: secretAbout,
      aboutTeam: [{ name: secretTeamMemberName, role: "Director", bio: secretBio }],
      logline: secretLogline,
      approximateBudget: "$2M - $4M",
      idealShootWindow: "Spring 2026",
    },
  });
  projectId = project.id;

  // A real project that exists but is never added to the slate below —
  // used to confirm the slate film page 404s for a non-member rather than
  // leaking that the project exists.
  const nonMemberProject = await prisma.project.create({
    data: {
      slug: `non-member-project-${rand}`,
      title: `Non-Member Project ${rand}`,
      productionCompany: "Secret Co",
      passwordHash: "unused-in-this-test",
      isPublished: true,
    },
  });
  nonMemberProjectId = nonMemberProject.id;
  nonMemberSlug = nonMemberProject.slug;

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

  slateSlug = `slate-gate-test-${crypto.randomUUID()}`;
  const bcrypt = (await import("bcryptjs")).default;
  const slate = await prisma.slate.create({
    data: {
      slug: slateSlug,
      title: `Secret Slate ${rand}`,
      passwordHash: await bcrypt.hash(SLATE_PASSWORD, 12),
      isPublished: true,
    },
  });
  slateId = slate.id;
  await prisma.slateProject.create({ data: { slateId, projectId } });

  // A second, unrelated slate — never includes projectId — used to confirm
  // a valid cookie for one slate can't be replayed against another's gate
  // or per-film pages.
  otherSlateSlug = `other-slate-gate-test-${crypto.randomUUID()}`;
  const otherSlate = await prisma.slate.create({
    data: {
      slug: otherSlateSlug,
      title: `Other Slate ${rand}`,
      passwordHash: await bcrypt.hash(OTHER_SLATE_PASSWORD, 12),
      isPublished: true,
    },
  });
  otherSlateId = otherSlate.id;

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
  // Slate delete cascades to its SlateProject membership row and its own
  // slate-level document; must run before the project delete below, since
  // SlateProject also references projectId.
  await prisma.slate.delete({ where: { id: slateId } }).catch(() => {});
  await prisma.slate.delete({ where: { id: otherSlateId } }).catch(() => {});
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.project.delete({ where: { id: nonMemberProjectId } }).catch(() => {});
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

describe("slate access via a real server (the one case that can't be unit-tested)", () => {
  // src/lib/access.test.ts covers member/non-member/removed/revoked/
  // cross-slate/expired/tampered at the function level directly — the one
  // thing that can't be tested that way is a successful login, since
  // createSlateSession() calls next/headers's cookies(), which only works
  // inside a real Next.js request. This exercises that through the actual
  // running server, then confirms the resulting cookie opens the member
  // project's room page with real, authenticated content.
  it("a correct slate password sets a cookie that opens the member project's room", async () => {
    const authRes = await fetch(`${BASE_URL}/api/slate/${slateSlug}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: SLATE_PASSWORD }),
    });
    expect(authRes.status).toBe(200);

    const setCookie = authRes.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`slate_${slateSlug}=`);
    const cookieValue = setCookie.split(";")[0];

    const roomRes = await fetch(`${BASE_URL}/${slug}/room/script`, {
      redirect: "manual",
      headers: { cookie: cookieValue! },
    });
    expect(roomRes.status).toBe(200);
    const body = await roomRes.text();
    expect(body).toContain(secretDocTitles.SCRIPT);
  });

  it("a wrong slate password is rejected with no cookie set", async () => {
    const authRes = await fetch(`${BASE_URL}/api/slate/${slateSlug}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    });
    expect(authRes.status).toBe(401);
    expect(authRes.headers.get("set-cookie")).toBeNull();
  });
});

// Everything a slate visitor shouldn't see before a valid, current-version
// session for *this* slate: the member film's own title, logline, team,
// budget/shoot-window, and its deck's document title. Checked against both
// the gate page and the per-film page in every invalid-session state below.
function slateFilmSecrets(): string[] {
  return [
    projectTitle,
    secretLogline,
    secretTeamMemberName,
    secretDocTitles.CREATIVE_DECK,
    "$2M - $4M",
    "Spring 2026",
  ];
}

async function currentSlateCookie(): Promise<string> {
  const current = await prisma.slate.findUniqueOrThrow({ where: { id: slateId } });
  const { signSlateToken } = await import("@/lib/slate-token");
  const token = await signSlateToken(slateId, slateSlug, current.sessionVersion);
  return `slate_${slateSlug}=${token}`;
}

async function expiredSlateCookie(): Promise<string> {
  const { SignJWT } = await import("jose");
  const secretBytes = new TextEncoder().encode(secretValue);
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    kind: "slate",
    slateId,
    slug: slateSlug,
    sessionVersion: 1,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now - 1000)
    .setExpirationTime(now - 500)
    .sign(secretBytes);
  return `slate_${slateSlug}=${token}`;
}

/**
 * A token correctly signed for the *other* slate, but placed under this
 * slate's cookie name (slate_<slateSlug>) — simulates a cookie value
 * copy-pasted from one slate session into another's slot. verifySlateToken
 * checks the payload's own embedded slug against the name-derived slug, so
 * this must be rejected exactly like no cookie at all.
 */
async function otherSlateCookieUnderThisName(): Promise<string> {
  const { signSlateToken } = await import("@/lib/slate-token");
  const token = await signSlateToken(otherSlateId, otherSlateSlug, 1);
  return `slate_${slateSlug}=${token}`;
}

describe("the slate's own gate/landing page (src/app/slate/[slug])", () => {
  it("shows the password gate, not the film grid, with no cookie", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}`, { redirect: "manual" });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Enter password");
    expect(body).not.toContain("Exit slate");
    for (const s of slateFilmSecrets()) {
      expect(body, `no cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("shows the gate, leaking nothing, with an expired cookie", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}`, {
      redirect: "manual",
      headers: { cookie: await expiredSlateCookie() },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Enter password");
    expect(body).not.toContain("Exit slate");
    for (const s of slateFilmSecrets()) {
      expect(body, `expired cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("shows the gate, leaking nothing, with a revoked (sessionVersion-bumped) cookie", async () => {
    // Signed while sessionVersion was 1 (or whatever it currently is),
    // then explicitly revoked — simulates a password change or an
    // explicit "revoke sessions" click happening after this cookie was
    // already issued.
    const { signSlateToken } = await import("@/lib/slate-token");
    const current = await prisma.slate.findUniqueOrThrow({ where: { id: slateId } });
    const staleToken = await signSlateToken(slateId, slateSlug, current.sessionVersion);
    await prisma.slate.update({
      where: { id: slateId },
      data: { sessionVersion: { increment: 1 } },
    });

    const res = await fetch(`${BASE_URL}/slate/${slateSlug}`, {
      redirect: "manual",
      headers: { cookie: `slate_${slateSlug}=${staleToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Enter password");
    expect(body).not.toContain("Exit slate");
    for (const s of slateFilmSecrets()) {
      expect(body, `revoked cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("shows the gate, leaking nothing, with another slate's cookie", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}`, {
      redirect: "manual",
      headers: { cookie: await otherSlateCookieUnderThisName() },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Enter password");
    expect(body).not.toContain("Exit slate");
    for (const s of slateFilmSecrets()) {
      expect(body, `other-slate cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("shows the real film grid for a valid, current-version cookie", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}`, {
      redirect: "manual",
      headers: { cookie: await currentSlateCookie() },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Exit slate");
    expect(body).toContain(projectTitle);
  });
});

describe("a film's dedicated slate page (src/app/slate/[slug]/[projectSlug])", () => {
  it("redirects to the slate's gate page with no slate session, leaking nothing", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}/${slug}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`/slate/${slateSlug}`);
    const body = await res.text();
    for (const s of slateFilmSecrets()) {
      expect(body, `no cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("redirects with an expired cookie, leaking nothing", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}/${slug}`, {
      redirect: "manual",
      headers: { cookie: await expiredSlateCookie() },
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`/slate/${slateSlug}`);
    const body = await res.text();
    for (const s of slateFilmSecrets()) {
      expect(body, `expired cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("redirects with a revoked (sessionVersion-bumped) cookie, leaking nothing", async () => {
    const { signSlateToken } = await import("@/lib/slate-token");
    const current = await prisma.slate.findUniqueOrThrow({ where: { id: slateId } });
    const staleToken = await signSlateToken(slateId, slateSlug, current.sessionVersion);
    await prisma.slate.update({
      where: { id: slateId },
      data: { sessionVersion: { increment: 1 } },
    });

    const res = await fetch(`${BASE_URL}/slate/${slateSlug}/${slug}`, {
      redirect: "manual",
      headers: { cookie: `slate_${slateSlug}=${staleToken}` },
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`/slate/${slateSlug}`);
    const body = await res.text();
    for (const s of slateFilmSecrets()) {
      expect(body, `revoked cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("redirects with another slate's cookie, leaking nothing", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}/${slug}`, {
      redirect: "manual",
      headers: { cookie: await otherSlateCookieUnderThisName() },
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`/slate/${slateSlug}`);
    const body = await res.text();
    for (const s of slateFilmSecrets()) {
      expect(body, `other-slate cookie leaked "${s}"`).not.toContain(s);
    }
  });

  it("shows logline, budget, shoot window, team and the embedded deck for a member film", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}/${slug}`, {
      redirect: "manual",
      headers: { cookie: await currentSlateCookie() },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(secretLogline);
    expect(body).toContain("$2M - $4M");
    expect(body).toContain("Spring 2026");
    expect(body).toContain(secretTeamMemberName);
    // The deck is embedded inline (DocumentSectionView, same viewer as a
    // room's own document sections) rather than just a download button —
    // its title and the "Email watermarked copy" request button both
    // render on this page directly.
    expect(body).toContain(secretDocTitles.CREATIVE_DECK);
    expect(body).toContain("Email watermarked copy");
    // Not the full multi-tab room — its own nav ("Exit room", section
    // tabs) never appears here.
    expect(body).not.toContain("Exit room");
  });

  it("404s for a real project that isn't a member of this slate, once authenticated — and never leaks its title via <title>", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}/${nonMemberSlug}`, {
      redirect: "manual",
      headers: { cookie: await currentSlateCookie() },
    });
    expect(res.status).toBe(404);
    const body = await res.text();
    // generateMetadata runs the same access check as the page body
    // (resolveSlateFilmAccess) — confirms it doesn't independently leak
    // the real project title into <head> just because this project
    // exists, regardless of the 404 the body itself renders.
    expect(body).not.toContain("Non-Member Project");
  });

  it("redirects for a non-member film slug with *no* cookie at all — never a distinguishable 404 (no enumeration of slate membership pre-auth)", async () => {
    const res = await fetch(`${BASE_URL}/slate/${slateSlug}/${nonMemberSlug}`, {
      redirect: "manual",
    });
    // Must match the no-cookie *member*-film case exactly (307 to the
    // gate) — if this were ever 404 instead, an unauthenticated visitor
    // could tell membership apart from non-membership (or a made-up slug)
    // without ever knowing the password.
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`/slate/${slateSlug}`);
  });
});
