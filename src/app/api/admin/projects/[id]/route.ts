import { NextRequest, NextResponse } from "next/server";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { projectUpdateSchema } from "@/lib/validation";
import { deleteObject } from "@/lib/storage";
import { bigIntMinorToNumber, parseMoneyMajorToMinor } from "@/lib/money";

// Prisma returns Project.grossBudget/equitySought/minimumTicket and each
// FinanceSource.amount as BigInt — JSON.stringify throws on a bare BigInt,
// so every response that includes these has to convert them to plain
// numbers first (always safe for a film budget — see schema.prisma).
function serializeProject<
  T extends {
    grossBudget: bigint | null;
    equitySought: bigint | null;
    minimumTicket: bigint | null;
    financeSources?: { amount: bigint }[];
  },
>(project: T) {
  return {
    ...project,
    grossBudget: bigIntMinorToNumber(project.grossBudget),
    equitySought: bigIntMinorToNumber(project.equitySought),
    minimumTicket: bigIntMinorToNumber(project.minimumTicket),
    ...(project.financeSources
      ? {
          financeSources: project.financeSources.map((s) => ({
            ...s,
            amount: bigIntMinorToNumber(s.amount),
          })),
        }
      : {}),
  };
}

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
      financeSources: { orderBy: { order: "asc" } },
      _count: { select: { downloads: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ project: serializeProject(project) });
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

  // Finance fields ("" clears a field, undefined leaves it alone — same
  // convention as tagline/accentColor above) are major-unit decimal
  // strings from the form; parseMoneyMajorToMinor returns null for "" and
  // for anything that fails validation, but the zod schema above has
  // already rejected anything malformed, so null here only ever means
  // "cleared".
  const financeFieldsTouched =
    data.currency !== undefined ||
    data.grossBudget !== undefined ||
    data.equitySought !== undefined ||
    data.minimumTicket !== undefined;

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
      ...(data.themeId ? { themeId: data.themeId } : {}),
      ...(data.accentColor !== undefined
        ? { accentColor: data.accentColor || null }
        : {}),
      ...(data.fontId !== undefined ? { fontId: data.fontId || null } : {}),
      ...(data.landingLayout ? { landingLayout: data.landingLayout } : {}),
      ...(data.roomLayout ? { roomLayout: data.roomLayout } : {}),
      ...(data.isPublished !== undefined
        ? { isPublished: data.isPublished }
        : {}),
      ...(data.aboutContent !== undefined
        ? { aboutContent: data.aboutContent }
        : {}),
      ...(data.aboutTeam !== undefined ? { aboutTeam: data.aboutTeam } : {}),
      ...(data.approximateBudget !== undefined
        ? { approximateBudget: data.approximateBudget || null }
        : {}),
      ...(data.idealShootWindow !== undefined
        ? { idealShootWindow: data.idealShootWindow || null }
        : {}),
      ...(data.currency !== undefined
        ? { currency: (data.currency || null) as Currency | null }
        : {}),
      ...(data.grossBudget !== undefined
        ? { grossBudget: toBigIntOrNull(data.grossBudget) }
        : {}),
      ...(data.equitySought !== undefined
        ? { equitySought: toBigIntOrNull(data.equitySought) }
        : {}),
      ...(data.minimumTicket !== undefined
        ? { minimumTicket: toBigIntOrNull(data.minimumTicket) }
        : {}),
      ...(financeFieldsTouched ? { financeUpdatedAt: new Date() } : {}),
      ...(data.password
        ? {
            passwordHash: await hashPassword(data.password),
            // Invalidates every room session issued under the old
            // password — see verifyRoomToken in src/lib/auth.ts.
            sessionVersion: { increment: 1 },
          }
        : {}),
    },
  });

  return NextResponse.json({ project: serializeProject(project) });
}

function toBigIntOrNull(majorAmount: string): bigint | null {
  const minor = parseMoneyMajorToMinor(majorAmount);
  return minor === null ? null : BigInt(minor);
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
    ...(project.logoKey ? [project.logoKey] : []),
  ];
  await Promise.allSettled(keys.map((key) => deleteObject(key)));

  return NextResponse.json({ ok: true });
}
