import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ProjectEditClient from "@/components/admin/ProjectEditClient";
import type { AdminProject } from "@/components/admin/types";

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  if (!project) notFound();

  const initialProject: AdminProject = {
    id: project.id,
    slug: project.slug,
    title: project.title,
    productionCompany: project.productionCompany,
    tagline: project.tagline,
    logline: project.logline,
    posterKey: project.posterKey,
    accentColor: project.accentColor,
    isPublished: project.isPublished,
    aboutContent: project.aboutContent,
    aboutTeam: Array.isArray(project.aboutTeam)
      ? (project.aboutTeam as unknown as AdminProject["aboutTeam"])
      : [],
    documents: project.documents.map((d) => ({
      id: d.id,
      section: d.section,
      title: d.title,
      fileName: d.fileName,
      fileSize: d.fileSize,
      order: d.order,
      createdAt: d.createdAt.toISOString(),
    })),
    gallery: project.gallery.map((g) => ({
      id: g.id,
      type: g.type,
      fileName: g.fileName,
      caption: g.caption,
      order: g.order,
    })),
    references: project.references.map((r) => ({
      id: r.id,
      label: r.label,
      url: r.url,
      order: r.order,
    })),
    _count: { downloads: project._count.downloads },
  };

  return <ProjectEditClient initialProject={initialProject} />;
}
