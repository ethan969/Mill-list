import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { slateUpdateSchema } from "@/lib/validation";
import { deleteObject } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const slate = await prisma.slate.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { order: "asc" } },
      projects: {
        orderBy: { order: "asc" },
        include: {
          project: { select: { id: true, slug: true, title: true, productionCompany: true } },
        },
      },
    },
  });

  if (!slate) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ slate });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = slateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid slate data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.slug) {
    const existing = await prisma.slate.findFirst({
      where: { slug: data.slug, NOT: { id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "That URL slug is already in use." },
        { status: 409 }
      );
    }
  }

  const slate = await prisma.slate.update({
    where: { id },
    data: {
      ...(data.slug ? { slug: data.slug } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.overview !== undefined ? { overview: data.overview || null } : {}),
      ...(data.aboutContent !== undefined
        ? { aboutContent: data.aboutContent || null }
        : {}),
      ...(data.themeId ? { themeId: data.themeId } : {}),
      ...(data.accentColor !== undefined
        ? { accentColor: data.accentColor || null }
        : {}),
      ...(data.fontId !== undefined ? { fontId: data.fontId || null } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      ...(data.password
        ? {
            passwordHash: await hashPassword(data.password),
            // Invalidates every slate session issued under the old
            // password — see verifySlateToken in src/lib/slate-token.ts.
            sessionVersion: { increment: 1 },
          }
        : {}),
    },
  });

  return NextResponse.json({ slate });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const slate = await prisma.slate.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!slate) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.slate.delete({ where: { id } });

  await Promise.allSettled(slate.documents.map((d) => deleteObject(d.fileKey)));

  return NextResponse.json({ ok: true });
}
