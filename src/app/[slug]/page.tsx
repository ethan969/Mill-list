import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getRoomSession } from "@/lib/auth";
import PasswordGateForm from "@/components/PasswordGateForm";
import ThemeWrapper from "@/components/ThemeWrapper";

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
      isPublished: true,
    },
  });

  if (!project || !project.isPublished) notFound();

  const session = await getRoomSession(slug);
  if (session && session.projectId === project.id) {
    redirect(`/${slug}/room`);
  }

  return (
    <ThemeWrapper
      themeId={project.themeId}
      accentColor={project.accentColor}
      className="relative flex flex-1 flex-col"
    >
      {project.posterKey && (
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/projects/${slug}/poster`}
            alt=""
            className="h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        {project.logoKey ? (
          <div className="animate-fade-up mb-6 h-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/projects/${slug}/logo`}
              alt={project.productionCompany}
              className="h-full w-auto object-contain"
            />
          </div>
        ) : (
          <p className="animate-fade-up font-display text-sm tracking-[0.35em] text-muted uppercase">
            {project.productionCompany}
          </p>
        )}
        <h1 className="animate-fade-up mt-5 max-w-3xl text-balance font-display text-5xl font-medium leading-tight sm:text-7xl">
          {project.title}
        </h1>
        {project.tagline && (
          <p
            className="animate-fade-up mt-6 max-w-xl text-balance text-base text-muted"
            style={{ animationDelay: "0.1s" }}
          >
            {project.tagline}
          </p>
        )}

        <div
          className="animate-fade-up mt-14 flex flex-col items-center"
          style={{ animationDelay: "0.15s" }}
        >
          <p className="mb-5 text-xs uppercase tracking-[0.3em] text-muted">
            Private Data Room
          </p>
          <PasswordGateForm slug={slug} />
        </div>
      </div>

      <footer className="pb-8 text-center text-[11px] text-muted/60">
        For authorized recipients only. Materials are confidential.
      </footer>
    </ThemeWrapper>
  );
}
