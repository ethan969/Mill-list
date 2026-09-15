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

// Curated display fonts, one per theme (see src/lib/themes.ts). All are
// loaded once here as CSS variables on <html>; a project's chosen theme
// then points the generic --font-display variable at one of these.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
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
