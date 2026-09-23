import type { Metadata } from "next";
import { body, DEFAULT_DISPLAY_FONT_VARIABLE } from "@/lib/loaded-fonts";
import "./globals.css";

// Only the body font and the default theme's display font are applied
// globally here. The other five curated display fonts (src/lib/themes.ts)
// are still instantiated (next/font requires that at module scope, via
// src/lib/loaded-fonts.ts) but only ever get applied per-project by
// ThemeWrapper — see that component for why.
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
    <html
      lang="en"
      className={`${body.variable} ${DEFAULT_DISPLAY_FONT_VARIABLE} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground font-sans"
        style={{ "--font-display": "var(--font-cormorant)" } as React.CSSProperties}
      >
        {children}
      </body>
    </html>
  );
}
