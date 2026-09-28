import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { slateCreateSchema } from "@/lib/validation";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const slates = await prisma.slate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      _count: { select: { projects: true, documents: true } },
    },
  });

  return NextResponse.json({ slates });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = slateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid slate data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.slate.findUnique({
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

  const slate = await prisma.slate.create({
    data: {
      slug: data.slug,
      title: data.title,
      overview: data.overview || null,
      accentColor: data.accentColor || undefined,
      passwordHash,
    },
  });

  return NextResponse.json({ slate }, { status: 201 });
}
