import type { DocumentSection } from "@prisma/client";

export type SectionDef = {
  key: DocumentSection;
  slug: string;
  label: string;
  description: string;
};

/** The four document sections that support flick-through viewing + watermarked download. */
export const DOCUMENT_SECTIONS: SectionDef[] = [
  {
    key: "SCRIPT",
    slug: "script",
    label: "Script",
    description: "The current draft of the screenplay.",
  },
  {
    key: "CREATIVE_DECK",
    slug: "creative-deck",
    label: "Creative Deck",
    description: "Look, tone, cast wishlist and creative vision.",
  },
  {
    key: "FINANCIALS",
    slug: "financials",
    label: "Financials",
    description: "Budget top sheet, finance plan and waterfall.",
  },
  {
    key: "PRODUCTION_PLAN",
    slug: "production-plan",
    label: "Production Plan",
    description: "Schedule, locations and production strategy.",
  },
];

export function sectionBySlug(slug: string): SectionDef | undefined {
  return DOCUMENT_SECTIONS.find((s) => s.slug === slug);
}

export function sectionByKey(key: DocumentSection): SectionDef {
  const found = DOCUMENT_SECTIONS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown document section: ${key}`);
  return found;
}

/** All six room sections in nav order, including the two non-document ones. */
export const ROOM_NAV: { slug: string; label: string }[] = [
  { slug: "script", label: "Script" },
  { slug: "creative-deck", label: "Creative Deck" },
  { slug: "financials", label: "Financials" },
  { slug: "about", label: "About Us" },
  { slug: "production-plan", label: "Production Plan" },
  { slug: "gallery", label: "Gallery & References" },
];
