import Link from "next/link";
import CapitalStackChart from "@/components/slate/CapitalStackChart";
import { CURRENCY_SYMBOLS, RECOUPMENT_STRUCTURES, type CurrencyOption } from "@/lib/finance-options";
import { formatMoneyMinorToMajor } from "@/lib/money";

export type SlateFinanceFilmRow =
  | {
      projectSlug: string;
      projectTitle: string;
      ok: true;
      committed: number;
      inNegotiation: number;
      sought: number;
      budget: number | null;
    }
  | {
      projectSlug: string;
      projectTitle: string;
      ok: false;
      from: string;
      to: string;
    };

export type SlateFinanceData = {
  displayCurrency: string;
  hasMissingRates: boolean;
  totalBudget: number;
  totalSources: number;
  committedTotal: number;
  inNegotiationTotal: number;
  soughtTotal: number;
  percentFinanced: number | null;
  /** Sum of each tracked film's equitySought, converted — null if none is set anywhere. */
  equitySought: number | null;
  /** The lowest minimumTicket among films that set one, converted — "starts from". Null if none is set. */
  minimumTicket: number | null;
  lastUpdated: string | null;
  recoupmentStructure: string | null;
  recoupmentNote: string | null;
  disclaimerText: string | null;
  films: SlateFinanceFilmRow[];
};

// The slate Overview's Finance panel — aggregate figures across every
// member film with finance tracking enabled, converted into the slate's
// display currency, plus a per-film capital stack chart. Only ever
// rendered from within the already-authenticated branch of
// src/app/slate/[slug]/page.tsx (see SlateFilmGrid) — the page itself
// only fetches this data at all once a valid slate session is confirmed,
// so there's nothing finance-related to leak pre-authentication.
export default function SlateFinanceOverview({
  slug,
  finance,
}: {
  slug: string;
  finance: SlateFinanceData;
}) {
  const symbol = CURRENCY_SYMBOLS[finance.displayCurrency as CurrencyOption] ?? "";
  const fmt = (minor: number) => `${symbol}${formatMoneyMinorToMajor(minor)}`;
  const structure = RECOUPMENT_STRUCTURES.find(
    (r) => r.value === finance.recoupmentStructure
  );

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div>
        <h2 className="font-display text-2xl">Finance</h2>
        <p className="mt-1 text-xs text-muted">
          Figures shown in {finance.displayCurrency}, converted from each
          film&apos;s own currency using the most recent stored exchange
          rate.
        </p>
      </div>

      {finance.hasMissingRates && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          One or more films couldn&apos;t be converted into{" "}
          {finance.displayCurrency} — an exchange rate for that currency
          pair hasn&apos;t been added yet, so this slate&apos;s totals below
          exclude them rather than guessing. See each film below for which.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Aggregate budget" value={fmt(finance.totalBudget)} />
        <Stat
          label="% financed"
          value={
            finance.percentFinanced !== null
              ? `${finance.percentFinanced.toFixed(1)}%`
              : "—"
          }
        />
        <Stat label="Committed" value={fmt(finance.committedTotal)} />
        <Stat
          label="In negotiation + sought"
          value={fmt(finance.inNegotiationTotal + finance.soughtTotal)}
        />
        {finance.equitySought !== null && (
          <Stat label="Equity sought" value={fmt(finance.equitySought)} />
        )}
        {finance.minimumTicket !== null && (
          <Stat label="Minimum ticket" value={`From ${fmt(finance.minimumTicket)}`} />
        )}
      </div>

      {structure && (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted">
            {structure.label}
          </p>
          <p className="mt-1 text-sm text-foreground/90">{structure.description}</p>
          {finance.recoupmentNote && (
            <p className="mt-2 max-w-prose text-sm text-foreground/80">{finance.recoupmentNote}</p>
          )}
        </div>
      )}

      {finance.films.length > 0 && (
        <div className="flex flex-col gap-5 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted">
            By film
          </p>
          {finance.films.map((film) =>
            film.ok ? (
              <div key={film.projectSlug} className="flex flex-col gap-2">
                <Link
                  href={`/slate/${slug}/${film.projectSlug}`}
                  className="text-sm hover:text-accent transition-colors"
                >
                  {film.projectTitle}
                </Link>
                <CapitalStackChart
                  currencySymbol={symbol}
                  committed={film.committed}
                  inNegotiation={film.inNegotiation}
                  sought={film.sought}
                  budget={film.budget}
                />
              </div>
            ) : (
              <div key={film.projectSlug} className="flex flex-col gap-1">
                <p className="text-sm">{film.projectTitle}</p>
                <p className="text-xs text-muted">
                  Can&apos;t convert from {film.from} to {film.to} — no exchange
                  rate on file.
                </p>
              </div>
            )
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-4 text-[11px] text-muted">
        {finance.lastUpdated && (
          <p>
            Last updated{" "}
            {new Date(finance.lastUpdated).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
        {finance.disclaimerText && <p className="max-w-prose">{finance.disclaimerText}</p>}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className="mt-1 text-sm tabular-nums">{value}</p>
    </div>
  );
}
