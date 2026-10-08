import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSlateSession } from "@/lib/auth";
import ThemeWrapper from "@/components/ThemeWrapper";
import SlateLanding from "@/components/slate/SlateLanding";
import SlateFilmGrid from "@/components/slate/SlateFilmGrid";
import type { SlateFilm } from "@/components/slate/SlateFilmCard";
import {
  calculateFilmFinance,
  calculateSlateFinance,
  convertAmount,
  type SlateFilmFinanceInput,
} from "@/lib/finance";
import type { SlateFinanceData } from "@/components/slate/SlateFinanceOverview";

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
      recoupmentStructure: true,
      recoupmentNote: true,
      disclaimerText: true,
      financeDisplayCurrency: true,
      projects: {
        orderBy: { order: "asc" },
        select: {
          project: {
            select: {
              id: true,
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

  // Finance data is only ever queried once a valid slate session is
  // confirmed above — never unconditionally — so there's nothing
  // finance-related in this page's output (including the RSC payload) for
  // an unauthenticated request, matching the no-film-titles-either
  // discipline the rest of this page already follows for `films` below.
  const slateProjects = slate.projects.filter((sp) => sp.project !== null);

  const finance = authenticated
    ? await loadSlateFinance(slate, slateProjects.map((sp) => sp.project!.id))
    : null;

  // Every slate member appears here, published or not: a film's slate page
  // (src/app/slate/[slug]/[projectSlug]) is access-controlled entirely
  // through slate membership, independent of the project's own
  // draft/published state.
  const films: SlateFilm[] = slateProjects.map((sp) => ({
    slug: sp.project!.slug,
    title: sp.project!.title,
    productionCompany: sp.project!.productionCompany,
    tagline: sp.project!.tagline,
    hasPoster: Boolean(sp.project!.posterKey),
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
          finance={finance}
        />
      ) : (
        <SlateLanding slug={slug} title={slate.title} overview={slate.overview} />
      )}
    </ThemeWrapper>
  );
}

/**
 * Loads and converts every member film's finance totals into the slate's
 * display currency (src/lib/finance.ts does the actual math). Returns
 * null when no member film has finance tracking enabled — nothing for
 * the Finance panel to show, so SlateFilmGrid omits the section entirely
 * rather than rendering an empty shell.
 *
 * "Equity sought" and "minimum ticket" aren't part of
 * calculateSlateFinance's own aggregate (that's budget/sources only), so
 * they're converted and combined here: equity sought is additive (the
 * total capital being raised across the slate), but a minimum ticket
 * isn't — it's the smallest check size for any one film, so the slate-
 * level figure is the lowest minimum among films that set one ("from
 * £X"), not a sum. Films whose currency can't be converted are left out
 * of both, the same never-guess discipline as the rest of this module.
 */
async function loadSlateFinance(
  slate: {
    financeDisplayCurrency: string;
    recoupmentStructure: string | null;
    recoupmentNote: string | null;
    disclaimerText: string | null;
  },
  projectIds: string[]
): Promise<SlateFinanceData | null> {
  if (projectIds.length === 0) return null;

  const [financeProjects, fxRates] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        slug: true,
        title: true,
        currency: true,
        grossBudget: true,
        equitySought: true,
        minimumTicket: true,
        financeUpdatedAt: true,
        financeSources: { select: { amount: true, status: true } },
      },
    }),
    prisma.fxRate.findMany(),
  ]);

  const displayCurrency = slate.financeDisplayCurrency as SlateFilmFinanceInput["currency"];
  const filmInputs: SlateFilmFinanceInput[] = [];
  const equityConversions: number[] = [];
  const minimumTicketConversions: number[] = [];
  const slugByProjectId = new Map(financeProjects.map((fp) => [fp.id, fp.slug]));

  for (const fp of financeProjects) {
    if (!fp.currency) continue;

    const totals = calculateFilmFinance(
      fp.currency,
      fp.grossBudget !== null ? Number(fp.grossBudget) : null,
      fp.financeSources.map((s) => ({ amount: Number(s.amount), status: s.status }))
    );
    if (!totals) continue;

    filmInputs.push({
      projectId: fp.id,
      projectTitle: fp.title,
      currency: fp.currency,
      totals,
      financeUpdatedAt: fp.financeUpdatedAt,
    });

    if (fp.equitySought !== null) {
      const converted = convertAmount(
        Number(fp.equitySought),
        fp.currency,
        displayCurrency,
        fxRates
      );
      if (converted.ok) equityConversions.push(converted.amount);
    }
    if (fp.minimumTicket !== null) {
      const converted = convertAmount(
        Number(fp.minimumTicket),
        fp.currency,
        displayCurrency,
        fxRates
      );
      if (converted.ok) minimumTicketConversions.push(converted.amount);
    }
  }

  if (filmInputs.length === 0) return null;

  const calc = calculateSlateFinance(displayCurrency, filmInputs, fxRates);

  return {
    displayCurrency: calc.displayCurrency,
    hasMissingRates: calc.hasMissingRates,
    totalBudget: calc.aggregate.totalBudget,
    totalSources: calc.aggregate.totalSources,
    committedTotal: calc.aggregate.committedTotal,
    inNegotiationTotal: calc.aggregate.inNegotiationTotal,
    soughtTotal: calc.aggregate.soughtTotal,
    percentFinanced: calc.aggregate.percentFinanced,
    equitySought:
      equityConversions.length > 0
        ? equityConversions.reduce((sum, v) => sum + v, 0)
        : null,
    minimumTicket:
      minimumTicketConversions.length > 0 ? Math.min(...minimumTicketConversions) : null,
    lastUpdated: calc.lastUpdated ? calc.lastUpdated.toISOString() : null,
    recoupmentStructure: slate.recoupmentStructure,
    recoupmentNote: slate.recoupmentNote,
    disclaimerText: slate.disclaimerText,
    films: calc.films.map((f) =>
      f.ok
        ? {
            projectSlug: slugByProjectId.get(f.projectId) ?? "",
            projectTitle: f.projectTitle,
            ok: true as const,
            committed: f.converted.committedTotal,
            inNegotiation: f.converted.inNegotiationTotal,
            sought: f.converted.soughtTotal,
            budget: f.converted.budget,
          }
        : {
            projectSlug: slugByProjectId.get(f.projectId) ?? "",
            projectTitle: f.projectTitle,
            ok: false as const,
            from: f.from,
            to: f.to,
          }
    ),
  };
}
