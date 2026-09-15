import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { projectCreateSchema } from "@/lib/validation";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      productionCompany: true,
      isPublished: true,
      createdAt: true,
      _count: { select: { documents: true, gallery: true } },
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid project data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.project.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "That URL slug is already in use." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(data.password);

  const project = await prisma.project.create({
    data: {
      slug: data.slug,
      title: data.title,
      productionCompany: data.productionCompany,
      tagline: data.tagline || null,
      logline: data.logline || null,
      accentColor: data.accentColor || undefined,
      passwordHash,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
