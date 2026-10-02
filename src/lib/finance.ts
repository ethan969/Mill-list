import { Prisma } from "@prisma/client";
import type { Currency, FinanceSourceStatus } from "@prisma/client";

/**
 * Pure, deterministic finance calculations — no I/O, no Prisma queries, no
 * next/headers. Callers (admin panels, the slate viewer) fetch rows from
 * the database, convert BigInt minor-unit columns to plain numbers (always
 * safe — see Project.grossBudget's schema comment), and pass them in here.
 *
 * Money is always a plain `number` of minor units (pence/cents) in this
 * module's own types — never a float dollar amount, never a BigInt. FX
 * rates are kept as Prisma.Decimal (exact decimal, not a binary float)
 * through every multiplication, and only rounded to an integer minor-unit
 * amount at the very end, so a chain of conversions never accumulates
 * float error.
 */

export type MoneyMinor = number;

// ---- Per-film totals ----

export type FinanceSourceInput = {
  amount: MoneyMinor;
  status: FinanceSourceStatus;
};

export type FilmFinanceTotals = {
  currency: Currency;
  /** Null if no budget has been entered yet — distinct from a budget of 0. */
  budget: MoneyMinor | null;
  totalSources: MoneyMinor;
  committedTotal: MoneyMinor;
  inNegotiationTotal: MoneyMinor;
  soughtTotal: MoneyMinor;
  /**
   * Null whenever a meaningful percentage can't be computed — no budget
   * entered, or a budget of exactly 0. Never Infinity/NaN; the caller
   * decides how to render "not yet known" vs. a real 0%–100%+ figure.
   */
  percentFinanced: number | null;
  /** budget - totalSources. Null under the same conditions as percentFinanced. */
  gapToBudget: MoneyMinor | null;
  /** True only when there's a real (non-null, >0) budget and sources exceed it. */
  sourcesExceedBudget: boolean;
};

/**
 * Rolls up one film's FinanceSource rows against its budget. Returns null
 * only when `currency` itself is null — i.e. finance tracking hasn't been
 * set up for this film at all, which is distinct from "set up but no
 * budget entered yet" (handled by `budget: null` below, still returning
 * real totals computed from whatever sources exist).
 */
export function calculateFilmFinance(
  currency: Currency | null,
  budget: MoneyMinor | null,
  sources: FinanceSourceInput[]
): FilmFinanceTotals | null {
  if (!currency) return null;

  let committedTotal = 0;
  let inNegotiationTotal = 0;
  let soughtTotal = 0;
  for (const source of sources) {
    if (source.status === "COMMITTED") committedTotal += source.amount;
    else if (source.status === "IN_NEGOTIATION") inNegotiationTotal += source.amount;
    else soughtTotal += source.amount;
  }
  const totalSources = committedTotal + inNegotiationTotal + soughtTotal;

  const hasRealBudget = budget !== null && budget > 0;
  const percentFinanced = hasRealBudget ? (totalSources / budget) * 100 : null;
  const gapToBudget = hasRealBudget ? budget - totalSources : null;
  const sourcesExceedBudget = hasRealBudget && totalSources > budget;

  return {
    currency,
    budget,
    totalSources,
    committedTotal,
    inNegotiationTotal,
    soughtTotal,
    percentFinanced,
    gapToBudget,
    sourcesExceedBudget,
  };
}

// ---- Currency conversion ----

export type FxRateRow = {
  from: Currency;
  to: Currency;
  /** Prisma returns Decimal fields as Prisma.Decimal; a string is also accepted for test convenience. */
  rate: Prisma.Decimal | string;
  asOfDate: Date;
};

export type ConversionResult =
  | { ok: true; amount: MoneyMinor; sameCurrency: true }
  | {
      ok: true;
      amount: MoneyMinor;
      sameCurrency: false;
      rate: string;
      asOfDate: Date;
    }
  | { ok: false; reason: "missing-rate"; from: Currency; to: Currency };

/**
 * Converts a minor-unit amount from one currency to another using the
 * most recent matching FxRate row. Deliberately never derives a rate that
 * isn't directly stored — not by inverting a reverse-direction rate, not
 * by chaining through a third currency, not by falling back to a stale
 * default. A missing rate is reported as `{ ok: false }`, for the caller
 * to show as an explicit error state; it is never 1:1, never 0, never
 * silently omitted from a sum.
 */
export function convertAmount(
  amountMinor: MoneyMinor,
  from: Currency,
  to: Currency,
  rates: FxRateRow[]
): ConversionResult {
  if (from === to) {
    return { ok: true, amount: amountMinor, sameCurrency: true };
  }

  let latest: FxRateRow | null = null;
  for (const row of rates) {
    if (row.from !== from || row.to !== to) continue;
    if (!latest || row.asOfDate > latest.asOfDate) latest = row;
  }
  if (!latest) {
    return { ok: false, reason: "missing-rate", from, to };
  }

  const rate = new Prisma.Decimal(latest.rate);
  const converted = rate
    .mul(amountMinor)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

  return {
    ok: true,
    amount: converted.toNumber(),
    sameCurrency: false,
    rate: rate.toString(),
    asOfDate: latest.asOfDate,
  };
}

// ---- Slate-level aggregation ----

export type SlateFilmFinanceInput = {
  projectId: string;
  projectTitle: string;
  currency: Currency;
  totals: FilmFinanceTotals;
  financeUpdatedAt: Date | null;
};

export type SlateFilmBreakdown =
  | {
      projectId: string;
      projectTitle: string;
      ok: true;
      /** This film's totals, converted into the slate's display currency. */
      converted: FilmFinanceTotals;
      conversion: Extract<ConversionResult, { ok: true }>;
    }
  | {
      projectId: string;
      projectTitle: string;
      ok: false;
      reason: "missing-rate";
      from: Currency;
      to: Currency;
    };

export type SlateFinanceAggregate = {
  totalBudget: MoneyMinor;
  totalSources: MoneyMinor;
  committedTotal: MoneyMinor;
  inNegotiationTotal: MoneyMinor;
  soughtTotal: MoneyMinor;
  /** Null under the same "no real budget" conditions as a film's own percentFinanced. */
  percentFinanced: number | null;
};

export type SlateFinanceTotals = {
  displayCurrency: Currency;
  films: SlateFilmBreakdown[];
  /** True if any member film's totals couldn't be converted — the aggregate below excludes them. */
  hasMissingRates: boolean;
  /** Computed only from films where ok: true. */
  aggregate: SlateFinanceAggregate;
  /** The most recent financeUpdatedAt among films included in the aggregate, or null if none have one. */
  lastUpdated: Date | null;
};

/**
 * Aggregates each member film's finance totals into the slate's display
 * currency. A film whose currency has no stored FX rate to the display
 * currency is reported individually as `{ ok: false }` and excluded from
 * `aggregate` — never guessed into the total at a 1:1 or stale rate.
 * `hasMissingRates` tells the caller to show a "partial data" warning
 * rather than presenting the aggregate as complete.
 */
export function calculateSlateFinance(
  displayCurrency: Currency,
  films: SlateFilmFinanceInput[],
  rates: FxRateRow[]
): SlateFinanceTotals {
  const breakdown: SlateFilmBreakdown[] = [];
  let hasMissingRates = false;
  let lastUpdated: Date | null = null;

  const agg = {
    totalBudget: 0,
    totalSources: 0,
    committedTotal: 0,
    inNegotiationTotal: 0,
    soughtTotal: 0,
  };

  for (const film of films) {
    const budgetConversion = convertAmount(
      film.totals.budget ?? 0,
      film.currency,
      displayCurrency,
      rates
    );
    const sourcesConversion = convertAmount(
      film.totals.totalSources,
      film.currency,
      displayCurrency,
      rates
    );
    const committedConversion = convertAmount(
      film.totals.committedTotal,
      film.currency,
      displayCurrency,
      rates
    );
    const inNegotiationConversion = convertAmount(
      film.totals.inNegotiationTotal,
      film.currency,
      displayCurrency,
      rates
    );
    const soughtConversion = convertAmount(
      film.totals.soughtTotal,
      film.currency,
      displayCurrency,
      rates
    );

    // All five conversions share the same (from, to) pair, so they either
    // all succeed or all fail together — checking one stands in for all.
    if (!budgetConversion.ok) {
      hasMissingRates = true;
      breakdown.push({
        projectId: film.projectId,
        projectTitle: film.projectTitle,
        ok: false,
        reason: "missing-rate",
        from: film.currency,
        to: displayCurrency,
      });
      continue;
    }

    const convertedBudget = film.totals.budget === null ? null : budgetConversion.amount;
    const convertedTotals: FilmFinanceTotals = {
      currency: displayCurrency,
      budget: convertedBudget,
      totalSources: (sourcesConversion as Extract<ConversionResult, { ok: true }>).amount,
      committedTotal: (committedConversion as Extract<ConversionResult, { ok: true }>).amount,
      inNegotiationTotal: (inNegotiationConversion as Extract<ConversionResult, { ok: true }>).amount,
      soughtTotal: (soughtConversion as Extract<ConversionResult, { ok: true }>).amount,
      percentFinanced: film.totals.percentFinanced,
      gapToBudget:
        convertedBudget !== null && convertedBudget > 0
          ? convertedBudget - (sourcesConversion as Extract<ConversionResult, { ok: true }>).amount
          : null,
      sourcesExceedBudget: film.totals.sourcesExceedBudget,
    };

    breakdown.push({
      projectId: film.projectId,
      projectTitle: film.projectTitle,
      ok: true,
      converted: convertedTotals,
      conversion: budgetConversion,
    });

    agg.totalBudget += convertedTotals.budget ?? 0;
    agg.totalSources += convertedTotals.totalSources;
    agg.committedTotal += convertedTotals.committedTotal;
    agg.inNegotiationTotal += convertedTotals.inNegotiationTotal;
    agg.soughtTotal += convertedTotals.soughtTotal;

    if (film.financeUpdatedAt && (!lastUpdated || film.financeUpdatedAt > lastUpdated)) {
      lastUpdated = film.financeUpdatedAt;
    }
  }

  const hasRealBudget = agg.totalBudget > 0;

  return {
    displayCurrency,
    films: breakdown,
    hasMissingRates,
    aggregate: {
      ...agg,
      percentFinanced: hasRealBudget ? (agg.totalSources / agg.totalBudget) * 100 : null,
    },
    lastUpdated,
  };
}
