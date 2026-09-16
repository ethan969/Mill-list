import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// One-time (and re-runnable) bootstrap for the admin account, triggered by
// visiting a URL rather than needing a terminal. Gated by SESSION_SECRET so
// only someone with access to the project's environment variables can use
// it — it never accepts credentials from the request, only from
// ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME already configured on the server,
// so hitting it just re-syncs the database to match those.
function html(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Admin setup</title>
    <style>body{font-family:system-ui,sans-serif;background:#0b0b0c;color:#f2f1ec;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{max-width:420px;padding:32px;text-align:center}
    a{color:#c9a24b}</style></head>
    <body><div class="card">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function tokenMatches(token: string, secret: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const secret = process.env.SESSION_SECRET ?? "";

  if (!token || !secret || !tokenMatches(token, secret)) {
    return html(
      `<h1>Not authorized</h1><p>Add <code>?token=</code> followed by your project's <code>SESSION_SECRET</code> value to this URL.</p>`,
      403
    );
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME;

  if (!email || !password) {
    return html(
      `<h1>Missing configuration</h1><p><code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code> must be set in this project's environment variables first.</p>`,
      400
    );
  }
  if (password.length < 8) {
    return html(`<h1>Password too short</h1><p><code>ADMIN_PASSWORD</code> must be at least 8 characters.</p>`, 400);
  }

  const passwordHash = await hashPassword(password);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  return html(
    `<h1>Admin account ready</h1><p>You can now sign in as <strong>${email}</strong> with the password you set.</p><p><a href="/admin/login">Go to sign in →</a></p>`
  );
}
