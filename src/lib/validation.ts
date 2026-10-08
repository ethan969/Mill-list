import { z } from "zod";
import { THEMES, FONTS } from "@/lib/themes";
import { LANDING_LAYOUTS, ROOM_LAYOUTS } from "@/lib/layouts";
import {
  CURRENCIES,
  FINANCE_SOURCE_TYPES,
  FINANCE_SOURCE_STATUSES,
  RECOUPMENT_STRUCTURES,
} from "@/lib/finance-options";

const THEME_IDS = THEMES.map((t) => t.id);
const FONT_IDS = FONTS.map((f) => f.id);
const LANDING_LAYOUT_IDS: string[] = LANDING_LAYOUTS.map((l) => l.id);
const ROOM_LAYOUT_IDS: string[] = ROOM_LAYOUTS.map((l) => l.id);
const CURRENCY_IDS: string[] = [...CURRENCIES];
const FINANCE_SOURCE_TYPE_IDS: string[] = FINANCE_SOURCE_TYPES.map((t) => t.value);
const FINANCE_SOURCE_STATUS_IDS: string[] = FINANCE_SOURCE_STATUSES.map((s) => s.value);
const RECOUPMENT_STRUCTURE_IDS: string[] = RECOUPMENT_STRUCTURES.map((r) => r.value);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

// Top-level path segments a project slug would otherwise collide with —
// "slate" is its own route namespace (/slate/[slug], parallel to a
// project's own /[slug]), so a project can't claim it as a slug.
const RESERVED_PROJECT_SLUGS = new Set(["slate"]);

const baseSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only"
  );

export const slugSchema = baseSlugSchema.refine(
  (v) => !RESERVED_PROJECT_SLUGS.has(v),
  "That URL slug is reserved"
);

// A slate's own slug lives under /slate/[slug] — a different namespace
// than project slugs, so it has no reason to reserve "slate" against
// itself.
export const slateSlugSchema = baseSlugSchema;

export const roomPasswordSchema = z.string().min(4).max(200);

export const currencySchema = z
  .string()
  .refine((v) => CURRENCY_IDS.includes(v), "Unknown currency");

// A major-unit decimal string typed into a form (e.g. "1250000.00"),
// parsed to integer minor units server-side by parseMoneyMajorToMinor —
// see src/lib/money.ts. Empty string means "leave unset".
export const moneyMajorSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount, e.g. 1250000.00")
  .optional()
  .or(z.literal(""));

export const financeSourceTypeSchema = z
  .string()
  .refine((v) => FINANCE_SOURCE_TYPE_IDS.includes(v), "Unknown source type");

export const financeSourceStatusSchema = z
  .string()
  .refine((v) => FINANCE_SOURCE_STATUS_IDS.includes(v), "Unknown source status");

export const recoupmentStructureSchema = z
  .string()
  .refine((v) => RECOUPMENT_STRUCTURE_IDS.includes(v), "Unknown recoupment structure");

export const financeSourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: financeSourceTypeSchema,
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount, e.g. 50000.00"),
  status: financeSourceStatusSchema,
  recoups: z.boolean().optional(),
  recoupmentPosition: z.number().int().positive().max(100).nullable().optional(),
  recoupmentPremiumBps: z.number().int().min(0).max(100_000).nullable().optional(),
});

export const financeSourceUpdateSchema = financeSourceCreateSchema.partial();

export const financeSourceReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export const fxRateCreateSchema = z
  .object({
    from: currencySchema,
    to: currencySchema,
    rate: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,8})?$/, "Enter a valid rate, e.g. 1.27000000"),
    asOfDate: z.string().trim().min(1, "Pick a date"),
  })
  .refine((d) => d.from !== d.to, {
    message: "From and To currencies must differ",
    path: ["to"],
  });

export const projectCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  productionCompany: z.string().trim().min(1).max(200),
  tagline: z.string().trim().max(300).optional().or(z.literal("")),
  logline: z.string().trim().max(1000).optional().or(z.literal("")),
  themeId: z
    .string()
    .refine((v) => THEME_IDS.includes(v), "Unknown theme")
    .optional(),
  fontId: z
    .string()
    .refine((v) => FONT_IDS.includes(v), "Unknown font")
    .optional()
    .or(z.literal("")),
  landingLayout: z
    .string()
    .refine((v) => LANDING_LAYOUT_IDS.includes(v), "Unknown landing layout")
    .optional(),
  roomLayout: z
    .string()
    .refine((v) => ROOM_LAYOUT_IDS.includes(v), "Unknown room layout")
    .optional(),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
  password: roomPasswordSchema,
});

export const teamMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const projectUpdateSchema = projectCreateSchema
  .partial()
  .extend({
    isPublished: z.boolean().optional(),
    aboutContent: z.string().max(20000).optional(),
    aboutTeam: z.array(teamMemberSchema).max(50).optional(),
    approximateBudget: z.string().trim().max(200).optional().or(z.literal("")),
    idealShootWindow: z.string().trim().max(200).optional().or(z.literal("")),
    // "" clears finance tracking for this film entirely (currency: null) —
    // see src/lib/finance.ts's calculateFilmFinance for what that means.
    currency: currencySchema.optional().or(z.literal("")),
    grossBudget: moneyMajorSchema,
    equitySought: moneyMajorSchema,
    minimumTicket: moneyMajorSchema,
  });

export const referenceLinkSchema = z.object({
  label: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000),
});

export const slateCreateSchema = z.object({
  slug: slateSlugSchema,
  title: z.string().trim().min(1).max(200),
  overview: z.string().trim().max(20000).optional().or(z.literal("")),
  themeId: z
    .string()
    .refine((v) => THEME_IDS.includes(v), "Unknown theme")
    .optional(),
  fontId: z
    .string()
    .refine((v) => FONT_IDS.includes(v), "Unknown font")
    .optional()
    .or(z.literal("")),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
  password: roomPasswordSchema,
});

export const slateUpdateSchema = slateCreateSchema.partial().extend({
  isPublished: z.boolean().optional(),
  aboutContent: z.string().max(20000).optional(),
  recoupmentStructure: recoupmentStructureSchema.optional().or(z.literal("")),
  recoupmentNote: z.string().trim().max(5000).optional().or(z.literal("")),
  disclaimerText: z.string().trim().max(5000).optional().or(z.literal("")),
  financeDisplayCurrency: currencySchema.optional(),
});
