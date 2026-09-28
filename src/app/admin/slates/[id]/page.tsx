import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import SlateEditClient from "@/components/admin/SlateEditClient";
import type { AdminSlate } from "@/components/admin/types";

export default async function SlateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const slate = await prisma.slate.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { order: "asc" } },
      projects: {
        orderBy: { order: "asc" },
        include: {
          project: {
            select: { id: true, slug: true, title: true, productionCompany: true },
          },
        },
      },
    },
  });

  if (!slate) notFound();

  const initialSlate: AdminSlate = {
    id: slate.id,
    slug: slate.slug,
    title: slate.title,
    overview: slate.overview,
    themeId: slate.themeId,
    accentColor: slate.accentColor,
    fontId: slate.fontId,
    documents: slate.documents.map((d) => ({
      id: d.id,
      section: d.section,
      title: d.title,
      fileName: d.fileName,
      fileSize: d.fileSize,
      order: d.order,
      createdAt: d.createdAt.toISOString(),
    })),
    projects: slate.projects.map((sp) => ({
      projectId: sp.projectId,
      order: sp.order,
      project: sp.project,
    })),
  };

  return <SlateEditClient initialSlate={initialSlate} />;
}
