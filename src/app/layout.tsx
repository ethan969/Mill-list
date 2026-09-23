import type { Metadata } from "next";
import {
  Inter,
  Cormorant_Garamond,
  Playfair_Display,
  Space_Grotesk,
  Libre_Baskerville,
  DM_Serif_Display,
  Bebas_Neue,
} from "next/font/google";
import "./globals.css";

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// Curated display fonts, one per theme (see src/lib/themes.ts). All six are
// declared once here as CSS variables on <html>, but any given page only
// ever renders text in one of them — `preload: false` stops the browser
// eagerly downloading all six on every page; declaring the @font-face still
// lets it lazily fetch just the one a project's theme actually applies via
// --font-display (src/lib/themes.ts#themeStyleVars).
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

const curatedFontVars = [
  body.variable,
  cormorant.variable,
  playfair.variable,
  spaceGrotesk.variable,
  libreBaskerville.variable,
  dmSerif.variable,
  bebas.variable,
].join(" ");

const siteName = process.env.SITE_NAME || "Mill List";

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: "A private data room for film financing and production materials.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${curatedFontVars} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col bg-background text-foreground font-sans"
        style={{ "--font-display": "var(--font-cormorant)" } as React.CSSProperties}
      >
        {children}
      </body>
    </html>
  );
}
