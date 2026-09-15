import { z } from "zod";
import { THEMES, FONTS } from "@/lib/themes";
import { LANDING_LAYOUTS, ROOM_LAYOUTS } from "@/lib/layouts";

const THEME_IDS = THEMES.map((t) => t.id);
const FONT_IDS = FONTS.map((f) => f.id);
const LANDING_LAYOUT_IDS: string[] = LANDING_LAYOUTS.map((l) => l.id);
const ROOM_LAYOUT_IDS: string[] = ROOM_LAYOUTS.map((l) => l.id);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only"
  );

export const roomPasswordSchema = z.string().min(4).max(200);

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
  });

export const referenceLinkSchema = z.object({
  label: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000),
});
