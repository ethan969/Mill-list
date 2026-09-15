import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { projectUpdateSchema } from "@/lib/validation";
import { deleteObject } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { order: "asc" } },
      gallery: { orderBy: { order: "asc" } },
      references: { orderBy: { order: "asc" } },
      _count: { select: { downloads: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid project data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.slug) {
    const existing = await prisma.project.findFirst({
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

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(data.slug ? { slug: data.slug } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.productionCompany
        ? { productionCompany: data.productionCompany }
        : {}),
      ...(data.tagline !== undefined ? { tagline: data.tagline || null } : {}),
      ...(data.logline !== undefined ? { logline: data.logline || null } : {}),
      ...(data.accentColor ? { accentColor: data.accentColor } : {}),
      ...(data.isPublished !== undefined
        ? { isPublished: data.isPublished }
        : {}),
      ...(data.aboutContent !== undefined
        ? { aboutContent: data.aboutContent }
        : {}),
      ...(data.aboutTeam !== undefined ? { aboutTeam: data.aboutTeam } : {}),
      ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
    },
  });

  return NextResponse.json({ project });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { documents: true, gallery: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });

  const keys = [
    ...project.documents.map((d) => d.fileKey),
    ...project.gallery.map((g) => g.fileKey),
    ...(project.posterKey ? [project.posterKey] : []),
  ];
  await Promise.allSettled(keys.map((key) => deleteObject(key)));

  return NextResponse.json({ ok: true });
}
