import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSlateSession } from "@/lib/auth";
import ThemeWrapper from "@/components/ThemeWrapper";
import SlateLanding from "@/components/slate/SlateLanding";
import SlateFilmGrid from "@/components/slate/SlateFilmGrid";
import type { SlateFilm } from "@/components/slate/SlateFilmCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const slate = await prisma.slate.findUnique({
    where: { slug },
    select: { title: true, isPublished: true },
  });
  if (!slate || !slate.isPublished) return {};
  return {
    title: slate.title,
    description: "A private, curated collection of films.",
  };
}

export default async function SlateLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const slate = await prisma.slate.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      overview: true,
      aboutContent: true,
      themeId: true,
      accentColor: true,
      fontId: true,
      isPublished: true,
      projects: {
        orderBy: { order: "asc" },
        select: {
          project: {
            select: {
              slug: true,
              title: true,
              productionCompany: true,
              tagline: true,
              posterKey: true,
            },
          },
        },
      },
    },
  });

  if (!slate || !slate.isPublished) notFound();

  const session = await getSlateSession(slug);
  const authenticated = Boolean(session && session.slateId === slate.id);

  // Every slate member appears here, published or not: a film's slate page
  // (src/app/slate/[slug]/[projectSlug]) is access-controlled entirely
  // through slate membership, independent of the project's own
  // draft/published state.
  const films: SlateFilm[] = slate.projects.map((sp) => ({
    slug: sp.project.slug,
    title: sp.project.title,
    productionCompany: sp.project.productionCompany,
    tagline: sp.project.tagline,
    hasPoster: Boolean(sp.project.posterKey),
  }));

  return (
    <ThemeWrapper
      themeId={slate.themeId}
      accentColor={slate.accentColor}
      fontId={slate.fontId}
      className="flex flex-1 flex-col"
    >
      {authenticated ? (
        <SlateFilmGrid
          slug={slug}
          title={slate.title}
          overview={slate.overview}
          aboutContent={slate.aboutContent}
          films={films}
        />
      ) : (
        <SlateLanding slug={slug} title={slate.title} overview={slate.overview} />
      )}
    </ThemeWrapper>
  );
}
