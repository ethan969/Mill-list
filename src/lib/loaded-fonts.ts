import {
  Inter,
  Cormorant_Garamond,
  Playfair_Display,
  Space_Grotesk,
  Libre_Baskerville,
  DM_Serif_Display,
  Bebas_Neue,
} from "next/font/google";

// next/font must be called at module scope, so all seven fonts have to be
// instantiated here regardless of which ones any given page uses. What
// varies per page is which of their `.variable` classes actually gets
// applied to the tree (see ThemeWrapper) — `preload: false` on the six
// display fonts means an unapplied one is never fetched at all, since
// nothing lazily requests a font whose custom property isn't in scope.

export const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});
const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  preload: false,
});
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
  preload: false,
});

/**
 * Every curated font's `.variable` class, keyed by the same font id used in
 * src/lib/themes.ts#FONTS. ThemeWrapper applies only the one entry a given
 * project actually needs, instead of the root layout applying all six
 * globally on every page.
 */
export const DISPLAY_FONT_VARIABLES: Record<string, string> = {
  cormorant: cormorant.variable,
  playfair: playfair.variable,
  "space-grotesk": spaceGrotesk.variable,
  "libre-baskerville": libreBaskerville.variable,
  "dm-serif": dmSerif.variable,
  bebas: bebas.variable,
};

/**
 * The default theme's font, kept globally available on <html> — pages
 * outside any project's ThemeWrapper (the neutral home page, the admin
 * panel) still use the `font-display` utility and need a font backing it.
 */
export const DEFAULT_DISPLAY_FONT_VARIABLE = cormorant.variable;
