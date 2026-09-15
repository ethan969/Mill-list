import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getRoomSession } from "@/lib/auth";
import ThemeWrapper from "@/components/ThemeWrapper";
import LandingCentered from "@/components/landing/LandingCentered";
import LandingSplit from "@/components/landing/LandingSplit";
import LandingFullBleed from "@/components/landing/LandingFullBleed";
import type { LandingProject } from "@/components/landing/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { title: true, productionCompany: true, isPublished: true },
  });
  if (!project || !project.isPublished) return {};
  return {
    title: project.title,
    description: `A private data room from ${project.productionCompany}.`,
  };
}

export default async function ProjectLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      productionCompany: true,
      tagline: true,
      posterKey: true,
      logoKey: true,
      themeId: true,
      accentColor: true,
      fontId: true,
      landingLayout: true,
      isPublished: true,
    },
  });

  if (!project || !project.isPublished) notFound();

  const session = await getRoomSession(slug);
  if (session && session.projectId === project.id) {
    redirect(`/${slug}/room`);
  }

  const landingProject: LandingProject = {
    slug,
    title: project.title,
    productionCompany: project.productionCompany,
    tagline: project.tagline,
    hasPoster: Boolean(project.posterKey),
    hasLogo: Boolean(project.logoKey),
  };

  return (
    <ThemeWrapper
      themeId={project.themeId}
      accentColor={project.accentColor}
      fontId={project.fontId}
      className="flex flex-1 flex-col"
    >
      {project.landingLayout === "split" ? (
        <LandingSplit project={landingProject} />
      ) : project.landingLayout === "full-bleed" ? (
        <LandingFullBleed project={landingProject} />
      ) : (
        <LandingCentered project={landingProject} />
      )}
    </ThemeWrapper>
  );
}
