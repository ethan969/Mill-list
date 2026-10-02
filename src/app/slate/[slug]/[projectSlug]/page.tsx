import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  requireSlateFilmAccess,
  resolveSlateFilmAccess,
} from "@/lib/require-slate-film-access";
import ThemeWrapper from "@/components/ThemeWrapper";
import PosterImage from "@/components/landing/PosterImage";
import SlateExitButton from "@/components/slate/SlateExitButton";
import DocumentSectionView from "@/components/DocumentSectionView";
import CapitalStackChart from "@/components/slate/CapitalStackChart";
import { calculateFilmFinance } from "@/lib/finance";
import { CURRENCY_SYMBOLS, type CurrencyOption } from "@/lib/finance-options";
import { formatMoneyMinorToMajor } from "@/lib/money";

type TeamMember = { name: string; role?: string; bio?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}): Promise<Metadata> {
  const { slug, projectSlug } = await params;
  // Same access check as the page body (resolveSlateFilmAccess, shared
  // with requireSlateFilmAccess below) — without it, the real film title
  // would render in <head> (and the RSC flight payload) independently of
  // whether the page body goes on to redirect or 404, including before
  // authentication.
  const result = await resolveSlateFilmAccess(slug, projectSlug);
  if (!result.ok) return {};

  const project = await prisma.project.findUnique({
    where: { id: result.projectId },
    select: { title: true },
  });
  if (!project) return {};
  return { title: project.title };
}

// A film's dedicated page within a slate — logline, team, approximate
// budget, ideal shooting window, and one downloadable deck. Deliberately
// not the project's own multi-tab room (script/creative-deck/financials/
// about/production-plan/gallery): those sections stay reserved for that
// project's own room password, never linked from a slate.
export default async function SlateFilmPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;
  const { projectId } = await requireSlateFilmAccess(slug, projectSlug);

  const [slate, project, deck] = await Promise.all([
    prisma.slate.findUnique({ where: { slug }, select: { title: true } }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        productionCompany: true,
        tagline: true,
        logline: true,
        posterKey: true,
        themeId: true,
        accentColor: true,
        fontId: true,
        aboutTeam: true,
        approximateBudget: true,
        idealShootWindow: true,
        currency: true,
        grossBudget: true,
        equitySought: true,
        minimumTicket: true,
        financeUpdatedAt: true,
        financeSources: { select: { amount: true, status: true } },
      },
    }),
    prisma.document.findFirst({
      where: { projectId, section: "CREATIVE_DECK" },
      orderBy: { order: "asc" },
      select: { id: true, title: true, pageCount: true, pageWidth: true, pageHeight: true },
    }),
  ]);

  if (!slate || !project) notFound();

  const team = Array.isArray(project.aboutTeam)
    ? (project.aboutTeam as unknown as TeamMember[])
    : [];

  // Only ever computed from data already fetched within this access-gated
  // page — see requireSlateFilmAccess above — so there's nothing finance-
  // related to leak for a non-member or unauthenticated request. Shown in
  // the film's own currency; no FX conversion here (that's the slate
  // Overview's job — see src/components/slate/SlateFinanceOverview.tsx).
  const finance = calculateFilmFinance(
    project.currency,
    project.grossBudget !== null ? Number(project.grossBudget) : null,
    project.financeSources.map((s) => ({ amount: Number(s.amount), status: s.status }))
  );
  const currencySymbol = project.currency
    ? CURRENCY_SYMBOLS[project.currency as CurrencyOption]
    : "";

  return (
    <ThemeWrapper
      themeId={project.themeId}
      accentColor={project.accentColor}
      fontId={project.fontId}
      className="flex flex-1 flex-col"
    >
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 sm:px-8">
          <Link
            href={`/slate/${slug}`}
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            ← {slate.title}
          </Link>
          <SlateExitButton slug={slug} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {project.posterKey && (
            <div className="w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border border-border">
              <PosterImage
                slug={projectSlug}
                sizes="220px"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted">
              {project.productionCompany}
            </p>
            <h1 className="font-display text-4xl">{project.title}</h1>
            {project.tagline && (
              <p className="text-sm text-muted">{project.tagline}</p>
            )}
          </div>
        </div>

        {project.logline && (
          <div>
            <h2 className="text-xs uppercase tracking-[0.25em] text-muted">
              Logline
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/90">
              {project.logline}
            </p>
          </div>
        )}

        {(project.approximateBudget || project.idealShootWindow) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {project.approximateBudget && (
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
                  Approximate budget
                </p>
                <p className="mt-2 font-display text-xl">
                  {project.approximateBudget}
                </p>
              </div>
            )}
            {project.idealShootWindow && (
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
                  Ideal shooting window
                </p>
                <p className="mt-2 font-display text-xl">
                  {project.idealShootWindow}
                </p>
              </div>
            )}
          </div>
        )}

        {finance && (
          <div className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h2 className="text-xs uppercase tracking-[0.25em] text-muted">
              Finance
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {finance.budget !== null && (
                <FinanceStat
                  label="Budget"
                  value={`${currencySymbol}${formatMoneyMinorToMajor(finance.budget)}`}
                />
              )}
              <FinanceStat
                label="% financed"
                value={
                  finance.percentFinanced !== null
                    ? `${finance.percentFinanced.toFixed(1)}%`
                    : "—"
                }
              />
              {project.equitySought !== null && (
                <FinanceStat
                  label="Equity sought"
                  value={`${currencySymbol}${formatMoneyMinorToMajor(Number(project.equitySought))}`}
                />
              )}
              <FinanceStat
                label="Minimum ticket"
                value={
                  project.minimumTicket !== null
                    ? `${currencySymbol}${formatMoneyMinorToMajor(Number(project.minimumTicket))}`
                    : "Contact us"
                }
              />
            </div>
            <div className="mt-5">
              <CapitalStackChart
                currencySymbol={currencySymbol}
                committed={finance.committedTotal}
                inNegotiation={finance.inNegotiationTotal}
                sought={finance.soughtTotal}
                budget={finance.budget}
              />
            </div>
            {project.financeUpdatedAt && (
              <p className="mt-4 text-[11px] text-muted">
                Last updated{" "}
                {project.financeUpdatedAt.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        )}

        {team.length > 0 && (
          <div>
            <h2 className="text-xs uppercase tracking-[0.25em] text-muted">
              Team
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((member, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface p-5"
                >
                  <p className="font-medium">{member.name}</p>
                  {member.role && (
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-accent">
                      {member.role}
                    </p>
                  )}
                  {member.bio && (
                    <p className="mt-3 text-sm text-muted">{member.bio}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border pt-8">
          {deck ? (
            <DocumentSectionView documents={[deck]} />
          ) : (
            <p className="text-sm text-muted">
              A deck for this film isn&apos;t available yet.
            </p>
          )}
        </div>
      </main>
    </ThemeWrapper>
  );
}

function FinanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
