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
              isPublished: true,
            },
          },
        },
      },
    },
  });

  if (!slate || !slate.isPublished) notFound();

  const session = await getSlateSession(slug);
  const authenticated = Boolean(session && session.slateId === slate.id);

  // A film only ever gets a page through its own room (see
  // src/app/[slug]/room), which 404s for an unpublished project even to a
  // valid slate cookie holder — so an unpublished member is left off this
  // list rather than linking to a page that wouldn't open.
  const films: SlateFilm[] = slate.projects
    .filter((sp) => sp.project.isPublished)
    .map((sp) => ({
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
          films={films}
        />
      ) : (
        <SlateLanding slug={slug} title={slate.title} overview={slate.overview} />
      )}
    </ThemeWrapper>
  );
}
