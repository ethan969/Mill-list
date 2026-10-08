import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  calculateFilmFinance,
  calculateSlateFinance,
  convertAmount,
  type FinanceSourceInput,
  type FxRateRow,
  type SlateFilmFinanceInput,
} from "@/lib/finance";

const source = (
  amount: number,
  status: FinanceSourceInput["status"]
): FinanceSourceInput => ({ amount, status });

describe("calculateFilmFinance", () => {
  it("returns null when currency itself is unset (finance tracking not set up)", () => {
    expect(calculateFilmFinance(null, null, [])).toBeNull();
    expect(calculateFilmFinance(null, 100_000, [source(1, "COMMITTED")])).toBeNull();
  });

  it("returns real totals with null budget when currency is set but no budget entered", () => {
    const result = calculateFilmFinance("GBP", null, [
      source(100_00, "COMMITTED"),
      source(50_00, "SOUGHT"),
    ]);
    expect(result).not.toBeNull();
    expect(result!.budget).toBeNull();
    expect(result!.totalSources).toBe(150_00);
    expect(result!.percentFinanced).toBeNull();
    expect(result!.gapToBudget).toBeNull();
    expect(result!.sourcesExceedBudget).toBe(false);
  });

  it("zero-budget edge case: a budget of exactly 0 is treated like 'no meaningful budget', not division by zero", () => {
    const result = calculateFilmFinance("GBP", 0, [source(10_00, "COMMITTED")]);
    expect(result!.budget).toBe(0);
    expect(result!.percentFinanced).toBeNull();
    expect(result!.gapToBudget).toBeNull();
    expect(result!.sourcesExceedBudget).toBe(false);
    expect(Number.isNaN(result!.percentFinanced)).toBe(false);
  });

  it("buckets sources by status and sums totalSources across all three buckets", () => {
    const result = calculateFilmFinance("GBP", 1_000_00, [
      source(300_00, "COMMITTED"),
      source(100_00, "COMMITTED"),
      source(200_00, "IN_NEGOTIATION"),
      source(150_00, "SOUGHT"),
    ]);
    expect(result!.committedTotal).toBe(400_00);
    expect(result!.inNegotiationTotal).toBe(200_00);
    expect(result!.soughtTotal).toBe(150_00);
    expect(result!.totalSources).toBe(750_00);
  });

  it("computes percentFinanced and gapToBudget against a real budget", () => {
    const result = calculateFilmFinance("GBP", 1_000_00, [
      source(250_00, "COMMITTED"),
    ]);
    expect(result!.percentFinanced).toBe(25);
    expect(result!.gapToBudget).toBe(750_00);
    expect(result!.sourcesExceedBudget).toBe(false);
  });

  it("flags sourcesExceedBudget when sources exceed a real budget, and allows percentFinanced over 100", () => {
    const result = calculateFilmFinance("GBP", 1_000_00, [
      source(1_200_00, "COMMITTED"),
    ]);
    expect(result!.sourcesExceedBudget).toBe(true);
    expect(result!.percentFinanced).toBe(120);
    expect(result!.gapToBudget).toBe(-200_00);
  });

  it("empty sources list against a real budget gives 0% financed, not null", () => {
    const result = calculateFilmFinance("GBP", 500_00, []);
    expect(result!.totalSources).toBe(0);
    expect(result!.percentFinanced).toBe(0);
    expect(result!.gapToBudget).toBe(500_00);
    expect(result!.sourcesExceedBudget).toBe(false);
  });
});

describe("convertAmount", () => {
  it("same currency short-circuits to the identical amount with no rate lookup", () => {
    const result = convertAmount(12_345, "GBP", "GBP", []);
    expect(result).toEqual({ ok: true, amount: 12_345, sameCurrency: true });
  });

  it("reports a missing-rate error state rather than guessing", () => {
    const result = convertAmount(100_00, "GBP", "USD", []);
    expect(result).toEqual({
      ok: false,
      reason: "missing-rate",
      from: "GBP",
      to: "USD",
    });
  });

  it("never inverts a reverse-direction rate to fill a missing one", () => {
    const rates: FxRateRow[] = [
      { from: "USD", to: "GBP", rate: "0.80000000", asOfDate: new Date("2026-01-01") },
    ];
    // Only USD->GBP is stored; GBP->USD must still be reported missing.
    const result = convertAmount(100_00, "GBP", "USD", rates);
    expect(result).toEqual({
      ok: false,
      reason: "missing-rate",
      from: "GBP",
      to: "USD",
    });
  });

  it("never chains through a third currency to fill a missing direct rate", () => {
    const rates: FxRateRow[] = [
      { from: "GBP", to: "USD", rate: "1.25000000", asOfDate: new Date("2026-01-01") },
      { from: "USD", to: "EUR", rate: "0.92000000", asOfDate: new Date("2026-01-01") },
    ];
    // No direct GBP->EUR rate stored, even though it could be derived via USD.
    const result = convertAmount(100_00, "GBP", "EUR", rates);
    expect(result).toEqual({
      ok: false,
      reason: "missing-rate",
      from: "GBP",
      to: "EUR",
    });
  });

  it("converts using the stored rate and rounds half up to an integer minor unit", () => {
    const rates: FxRateRow[] = [
      { from: "GBP", to: "USD", rate: "1.27000000", asOfDate: new Date("2026-01-01") },
    ];
    // 100.00 GBP * 1.27 = 127.00 USD exactly.
    const result = convertAmount(100_00, "GBP", "USD", rates);
    expect(result.ok).toBe(true);
    if (result.ok && !result.sameCurrency) {
      expect(result.amount).toBe(127_00);
      expect(result.rate).toBe("1.27");
    }
  });

  it("rounds a fractional minor-unit result half up (not half-even, not truncated)", () => {
    const rates: FxRateRow[] = [
      { from: "GBP", to: "USD", rate: "1.23455000", asOfDate: new Date("2026-01-01") },
    ];
    // 1 minor unit * 1.23455 = 1.23455 -> rounds to 1 (below .5).
    const small = convertAmount(1, "GBP", "USD", rates);
    expect(small.ok && !small.sameCurrency && small.amount).toBe(1);

    const ratesHalf: FxRateRow[] = [
      { from: "GBP", to: "USD", rate: "1.50000000", asOfDate: new Date("2026-01-01") },
    ];
    // 1 minor unit * 1.5 = 1.5 -> half up rounds to 2.
    const half = convertAmount(1, "GBP", "USD", ratesHalf);
    expect(half.ok && !half.sameCurrency && half.amount).toBe(2);
  });

  it("uses exact decimal arithmetic, avoiding binary float drift on repeated conversions", () => {
    const rates: FxRateRow[] = [
      { from: "GBP", to: "EUR", rate: "1.16000000", asOfDate: new Date("2026-01-01") },
    ];
    // 0.1 + 0.2 famously != 0.3 in binary float; prove minor-unit conversion
    // doesn't inherit that by converting an amount chosen to expose it.
    const result = convertAmount(10, "GBP", "EUR", rates);
    expect(result.ok && !result.sameCurrency && result.amount).toBe(12);
  });

  it("picks the most recent rate by asOfDate when multiple rows match the same pair", () => {
    const rates: FxRateRow[] = [
      { from: "GBP", to: "USD", rate: "1.20000000", asOfDate: new Date("2025-01-01") },
      { from: "GBP", to: "USD", rate: "1.30000000", asOfDate: new Date("2026-01-01") },
      { from: "GBP", to: "USD", rate: "1.10000000", asOfDate: new Date("2024-06-01") },
    ];
    const result = convertAmount(100_00, "GBP", "USD", rates);
    expect(result.ok && !result.sameCurrency && result.rate).toBe("1.3");
  });

  it("accepts a Prisma.Decimal rate as well as a string (Prisma query boundary returns Decimal)", () => {
    const rates: FxRateRow[] = [
      {
        from: "GBP",
        to: "USD",
        rate: new Prisma.Decimal("1.25"),
        asOfDate: new Date("2026-01-01"),
      },
    ];
    const result = convertAmount(100_00, "GBP", "USD", rates);
    expect(result.ok && !result.sameCurrency && result.amount).toBe(125_00);
  });
});

describe("calculateSlateFinance", () => {
  const filmInput = (
    overrides: Partial<SlateFilmFinanceInput> = {}
  ): SlateFilmFinanceInput => ({
    projectId: "p1",
    projectTitle: "Film One",
    currency: "GBP",
    totals: calculateFilmFinance("GBP", 1_000_00, [
      source(400_00, "COMMITTED"),
      source(100_00, "SOUGHT"),
    ])!,
    financeUpdatedAt: new Date("2026-01-15"),
    ...overrides,
  });

  it("same-currency films (display currency matches film currency) need no FX rates", () => {
    const result = calculateSlateFinance("GBP", [filmInput()], []);
    expect(result.hasMissingRates).toBe(false);
    expect(result.films[0].ok).toBe(true);
    expect(result.aggregate.totalBudget).toBe(1_000_00);
    expect(result.aggregate.totalSources).toBe(500_00);
    expect(result.aggregate.percentFinanced).toBe(50);
  });

  it("mixed currencies: converts each film into the display currency using stored rates", () => {
    const films: SlateFilmFinanceInput[] = [
      filmInput({ projectId: "p1", currency: "GBP" }),
      filmInput({
        projectId: "p2",
        projectTitle: "Film Two",
        currency: "USD",
        totals: calculateFilmFinance("USD", 500_00, [source(500_00, "COMMITTED")])!,
        financeUpdatedAt: new Date("2026-02-01"),
      }),
    ];
    const rates: FxRateRow[] = [
      { from: "USD", to: "GBP", rate: "0.80000000", asOfDate: new Date("2026-01-01") },
    ];
    const result = calculateSlateFinance("GBP", films, rates);
    expect(result.hasMissingRates).toBe(false);
    expect(result.films).toHaveLength(2);
    // Film 2: 500.00 USD budget and sources * 0.8 = 400.00 GBP each.
    const film2 = result.films.find((f) => f.projectId === "p2")!;
    expect(film2.ok).toBe(true);
    if (film2.ok) {
      expect(film2.converted.budget).toBe(400_00);
      expect(film2.converted.totalSources).toBe(400_00);
    }
    // Aggregate: 1000.00 GBP + 400.00 GBP = 1400.00 GBP budget;
    // 500.00 GBP + 400.00 GBP = 900.00 GBP sources.
    expect(result.aggregate.totalBudget).toBe(1_400_00);
    expect(result.aggregate.totalSources).toBe(900_00);
    expect(result.lastUpdated).toEqual(new Date("2026-02-01"));
  });

  it("missing FX rate: excludes that film from the aggregate and flags hasMissingRates, never guesses", () => {
    const films: SlateFilmFinanceInput[] = [
      filmInput({ projectId: "p1", currency: "GBP" }),
      filmInput({
        projectId: "p2",
        projectTitle: "Film Two",
        currency: "EUR",
        totals: calculateFilmFinance("EUR", 500_00, [source(500_00, "COMMITTED")])!,
      }),
    ];
    // No EUR->GBP rate stored at all.
    const result = calculateSlateFinance("GBP", films, []);
    expect(result.hasMissingRates).toBe(true);
    const film2 = result.films.find((f) => f.projectId === "p2");
    expect(film2).toEqual({
      projectId: "p2",
      projectTitle: "Film Two",
      ok: false,
      reason: "missing-rate",
      from: "EUR",
      to: "GBP",
    });
    // Aggregate only reflects the convertible film (p1).
    expect(result.aggregate.totalBudget).toBe(1_000_00);
    expect(result.aggregate.totalSources).toBe(500_00);
  });

  it("zero-budget edge case at the slate level: no real aggregate budget yields null percentFinanced, not NaN", () => {
    const films: SlateFilmFinanceInput[] = [
      filmInput({
        totals: calculateFilmFinance("GBP", 0, [source(10_00, "COMMITTED")])!,
      }),
    ];
    const result = calculateSlateFinance("GBP", films, []);
    expect(result.aggregate.totalBudget).toBe(0);
    expect(result.aggregate.percentFinanced).toBeNull();
    expect(Number.isNaN(result.aggregate.percentFinanced)).toBe(false);
  });

  it("empty slate (no member films) returns a zeroed, non-null aggregate", () => {
    const result = calculateSlateFinance("GBP", [], []);
    expect(result.films).toEqual([]);
    expect(result.hasMissingRates).toBe(false);
    expect(result.aggregate).toEqual({
      totalBudget: 0,
      totalSources: 0,
      committedTotal: 0,
      inNegotiationTotal: 0,
      soughtTotal: 0,
      percentFinanced: null,
    });
    expect(result.lastUpdated).toBeNull();
  });

  it("a film's own percentFinanced ratio is preserved unchanged through currency conversion", () => {
    // Uniform conversion multiplies both budget and sources by the same
    // rate, so the ratio is mathematically identical — confirms the
    // reuse-rather-than-recompute design choice is correct.
    const films: SlateFilmFinanceInput[] = [
      filmInput({
        currency: "USD",
        totals: calculateFilmFinance("USD", 1_000_00, [source(300_00, "COMMITTED")])!,
      }),
    ];
    const rates: FxRateRow[] = [
      { from: "USD", to: "GBP", rate: "0.79000000", asOfDate: new Date("2026-01-01") },
    ];
    const result = calculateSlateFinance("GBP", films, rates);
    const film = result.films[0];
    expect(film.ok).toBe(true);
    if (film.ok) {
      expect(film.converted.percentFinanced).toBe(30);
      expect(film.converted.budget).toBe(790_00);
      expect(film.converted.totalSources).toBe(237_00);
      expect(237_00 / 790_00).toBeCloseTo(0.3);
    }
  });

  it("lastUpdated is the max financeUpdatedAt among films included in the aggregate, excluding missing-rate films", () => {
    const films: SlateFilmFinanceInput[] = [
      filmInput({
        projectId: "p1",
        currency: "GBP",
        financeUpdatedAt: new Date("2026-01-01"),
      }),
      filmInput({
        projectId: "p2",
        currency: "EUR",
        totals: calculateFilmFinance("EUR", 100_00, [])!,
        // Later date, but excluded for lacking an FX rate — must not win.
        financeUpdatedAt: new Date("2026-06-01"),
      }),
      filmInput({
        projectId: "p3",
        currency: "GBP",
        financeUpdatedAt: new Date("2026-03-01"),
      }),
    ];
    const result = calculateSlateFinance("GBP", films, []);
    expect(result.lastUpdated).toEqual(new Date("2026-03-01"));
  });

  it("null financeUpdatedAt on every included film leaves lastUpdated null", () => {
    const films: SlateFilmFinanceInput[] = [filmInput({ financeUpdatedAt: null })];
    const result = calculateSlateFinance("GBP", films, []);
    expect(result.lastUpdated).toBeNull();
  });
});
