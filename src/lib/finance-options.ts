/**
 * String-literal option lists for the finance enums (Currency,
 * FinanceSourceType, FinanceSourceStatus, RecoupmentStructure). Kept free
 * of any @prisma/client import — unlike src/lib/finance.ts, this file is
 * imported directly by client components ("use client") for dropdown
 * options and labels, and @prisma/client's generated module isn't meant
 * to be bundled into browser JS.
 */

export const CURRENCIES = ["GBP", "USD", "EUR"] as const;
export type CurrencyOption = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<CurrencyOption, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export const FINANCE_SOURCE_TYPES = [
  { value: "EQUITY", label: "Equity" },
  { value: "BFI", label: "BFI" },
  { value: "TAX_CREDIT", label: "Tax credit" },
  { value: "PRESALE", label: "Presale" },
  { value: "GAP", label: "Gap" },
  { value: "DEBT", label: "Debt" },
  { value: "SOFT_MONEY", label: "Soft money" },
  { value: "OTHER", label: "Other" },
] as const;
export type FinanceSourceTypeOption = (typeof FINANCE_SOURCE_TYPES)[number]["value"];

export const FINANCE_SOURCE_STATUSES = [
  { value: "COMMITTED", label: "Committed" },
  { value: "IN_NEGOTIATION", label: "In negotiation" },
  { value: "SOUGHT", label: "Sought" },
] as const;
export type FinanceSourceStatusOption = (typeof FINANCE_SOURCE_STATUSES)[number]["value"];

export const RECOUPMENT_STRUCTURES = [
  {
    value: "RING_FENCED",
    label: "Ring-fenced",
    description:
      "Each film's capital stack recoups independently, from that film's own revenue only.",
  },
  {
    value: "CROSS_COLLATERALISED",
    label: "Cross-collateralised",
    description:
      "Films in this slate share recoupment across their combined revenue.",
  },
] as const;
export type RecoupmentStructureOption = (typeof RECOUPMENT_STRUCTURES)[number]["value"];

export function financeSourceTypeLabel(value: string): string {
  return FINANCE_SOURCE_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function financeSourceStatusLabel(value: string): string {
  return FINANCE_SOURCE_STATUSES.find((s) => s.value === value)?.label ?? value;
}
