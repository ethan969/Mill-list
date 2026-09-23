export type Theme = {
  id: string;
  label: string;
  description: string;
  fontVar: string; // CSS variable name holding the curated display font, set in layout.tsx
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    border: string;
    foreground: string;
    muted: string;
    accent: string;
    accentForeground: string;
  };
};

export const THEMES: Theme[] = [
  {
    id: "midnight-gold",
    label: "Midnight Gold",
    description: "Prestige drama. Near-black with warm gold and an elegant serif.",
    fontVar: "--font-cormorant",
    colors: {
      background: "#0b0b0c",
      surface: "#141416",
      surfaceRaised: "#1c1c1f",
      border: "#2a2a2e",
      foreground: "#f2f1ec",
      muted: "#a3a29b",
      accent: "#c9a24b",
      accentForeground: "#14120a",
    },
  },
  {
    id: "blood-moon",
    label: "Blood Moon",
    description: "Horror & thriller. Near-black with a deep red and a dramatic serif.",
    fontVar: "--font-playfair",
    colors: {
      background: "#0a0505",
      surface: "#160b0b",
      surfaceRaised: "#1f1010",
      border: "#331616",
      foreground: "#f2ecec",
      muted: "#a89a9a",
      accent: "#b5342c",
      accentForeground: "#fdf1ef",
    },
  },
  {
    id: "neon-nights",
    label: "Neon Nights",
    description: "Sci-fi & action. Deep navy-black with cyan and a geometric sans.",
    fontVar: "--font-space-grotesk",
    colors: {
      background: "#05070c",
      surface: "#0d1220",
      surfaceRaised: "#131a2e",
      border: "#22304a",
      foreground: "#eef3fb",
      muted: "#8fa0bd",
      accent: "#35e0c9",
      accentForeground: "#04211d",
    },
  },
  {
    id: "paper-ink",
    label: "Paper & Ink",
    description: "Indie & period drama. Warm cream paper with burgundy and a classic serif.",
    fontVar: "--font-libre-baskerville",
    colors: {
      background: "#f3ede1",
      surface: "#ece3d3",
      surfaceRaised: "#e3d8c3",
      border: "#d3c4a8",
      foreground: "#241f16",
      muted: "#6b6152",
      accent: "#7a2e2e",
      accentForeground: "#fbeeee",
    },
  },
  {
    id: "sundance",
    label: "Sundance",
    description: "Indie comedy & dramedy. Warm charcoal-brown with amber and a soft serif.",
    fontVar: "--font-dm-serif",
    colors: {
      background: "#120d09",
      surface: "#1c140d",
      surfaceRaised: "#261b11",
      border: "#3a2a1a",
      foreground: "#f3ead9",
      muted: "#b3a189",
      accent: "#e08a3c",
      accentForeground: "#1a0f04",
    },
  },
  {
    id: "mono-noir",
    label: "Mono Noir",
    description: "Crime & documentary. High-contrast black and white with a bold condensed titling font.",
    fontVar: "--font-bebas",
    colors: {
      background: "#050505",
      surface: "#101010",
      surfaceRaised: "#181818",
      border: "#2b2b2b",
      foreground: "#f5f5f5",
      muted: "#999999",
      accent: "#e5e5e5",
      accentForeground: "#050505",
    },
  },
];

export const DEFAULT_THEME_ID = "midnight-gold";

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

export type FontOption = {
  id: string;
  label: string;
  description: string;
  fontVar: string; // matches a --font-* variable loaded in src/app/layout.tsx
};

/**
 * The titling fonts available independently of theme. Each theme suggests
 * one of these as its default (Theme.fontVar), but a project can pick any
 * of them regardless of which color theme it uses.
 */
export const FONTS: FontOption[] = [
  {
    id: "cormorant",
    label: "Cormorant Garamond",
    description: "Elegant, high-contrast serif",
    fontVar: "--font-cormorant",
  },
  {
    id: "playfair",
    label: "Playfair Display",
    description: "Dramatic, editorial serif",
    fontVar: "--font-playfair",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    description: "Modern, geometric sans",
    fontVar: "--font-space-grotesk",
  },
  {
    id: "libre-baskerville",
    label: "Libre Baskerville",
    description: "Classic book serif",
    fontVar: "--font-libre-baskerville",
  },
  {
    id: "dm-serif",
    label: "DM Serif Display",
    description: "Warm, soft serif",
    fontVar: "--font-dm-serif",
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    description: "Bold, condensed titling caps",
    fontVar: "--font-bebas",
  },
];

export function getFont(id: string | null | undefined): FontOption | null {
  return FONTS.find((f) => f.id === id) ?? null;
}

/**
 * The font id actually in effect for a project: its own override if set,
 * else whichever curated font its theme suggests. Used to apply only that
 * one font's next/font `.variable` class (see src/lib/loaded-fonts.ts)
 * rather than loading all six globally.
 */
export function resolveFontId(
  themeId: string | null | undefined,
  fontIdOverride?: string | null
): string {
  if (fontIdOverride && getFont(fontIdOverride)) return fontIdOverride;
  const theme = getTheme(themeId);
  return FONTS.find((f) => f.fontVar === theme.fontVar)?.id ?? FONTS[0]!.id;
}

/** Picks readable black/white text for an arbitrary hex background color. */
function readableForeground(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return "#0a0a0a";
  const n = parseInt(match[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#14120a" : "#fbf9f3";
}

/**
 * CSS custom properties for a project's chosen theme, with an optional
 * accent-color override and an optional font override (independent of the
 * theme's own suggested font).
 */
export function themeStyleVars(
  themeId: string | null | undefined,
  accentOverride?: string | null,
  fontIdOverride?: string | null
): Record<string, string> {
  const theme = getTheme(themeId);
  const accent = accentOverride || theme.colors.accent;
  const accentForeground = accentOverride
    ? readableForeground(accentOverride)
    : theme.colors.accentForeground;
  const fontVar = getFont(fontIdOverride)?.fontVar ?? theme.fontVar;
  return {
    // Tailwind's `@theme inline` block in globals.css maps e.g.
    // --color-background to var(--background) and *inlines* that
    // reference into every utility that uses it (so `.bg-background`
    // compiles to `background-color: var(--background)`, not
    // `var(--color-background)`). These per-project overrides have to
    // target those underlying bare variable names, not the `--color-*`
    // ones, or Tailwind's compiled utilities never see them.
    "--background": theme.colors.background,
    "--surface": theme.colors.surface,
    "--surface-raised": theme.colors.surfaceRaised,
    "--border": theme.colors.border,
    "--foreground": theme.colors.foreground,
    "--muted": theme.colors.muted,
    "--accent": accent,
    "--accent-foreground": accentForeground,
    "--font-display": `var(${fontVar})`,
  };
}
