# Design defaults audit — before `design-system`

Screenshots in this folder: `{gate, room-landing, script-viewer, finance-panel, slate-overview, gallery} × {390px, 1440px}`, captured against a real seeded project ("The Long Arrival" / Northwind Pictures) and slate ("Autumn Slate 2026") on the `midnight-gold` theme, authenticated via the real room/slate password flows.

View mapping, since two of the six names don't correspond 1:1 to a single route:
- **gate** → `/[slug]` (the project landing page, which doubles as the room password gate)
- **room landing** → `/[slug]/room/about` — `/[slug]/room` itself has no distinct content; it immediately redirects to the first available document section (`src/app/[slug]/room/page.tsx:17-19`), which would otherwise duplicate the script-viewer shot. `/room/about` is the room's own genuinely distinct landing template.
- **script viewer** → `/[slug]/room/script`
- **finance panel** → `/slate/[slug]/[projectSlug]` (a film's own Finance section)
- **slate overview** → `/slate/[slug]` (authenticated — aggregate Finance panel + film grid)
- **gallery** → `/[slug]/room/gallery`

## Inventory of the named defaults

### 1. Identical rounded cards
Present almost everywhere a panel, tile, or pill needs a boundary — `rounded-xl`/`rounded-lg`/`rounded-md`/`rounded-full` appear in 33 files across the codebase. In the six audited views specifically:
- `src/components/landing/LandingCentered.tsx:51` — the password-gate card (`rounded-xl`)
- `src/components/PasswordGateForm.tsx:56` — the input+button pill itself (`rounded-full`), nested inside the card above
- `src/app/[slug]/room/about/page.tsx` team bio tiles — `rounded-lg border border-border bg-surface p-5` (same recipe as nearly every card sitewide)
- `src/components/GalleryGrid.tsx` gallery thumbnails — `rounded-md`
- `src/app/slate/[slug]/[projectSlug]/page.tsx` finance stat tiles and `src/components/slate/SlateFinanceOverview.tsx` — same `rounded-md border border-border bg-surface/bg-background/40 p-3` tile, reused verbatim across the admin finance editor, the per-film page, and the slate overview
- `src/components/DocumentSectionView.tsx:63` — the "Email watermarked copy" button, `rounded-md`
- `src/components/slate/SlateFilmCard.tsx` — the film card itself, `rounded-lg`

Every card in every view, regardless of content (team bio, finance stat, gallery still, film card), uses the same corner radius + `border-border` + `bg-surface` recipe — there is currently no visual vocabulary distinguishing one kind of grouping from another.

### 2. Soft grey shadows
- `src/app/globals.css:103` — `.react-pdf__Page__canvas { box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.6); }`, applied to every script/deck page in the script viewer (visible as a soft drop shadow under the white page in `script-viewer-*.png`).
- `src/components/PasswordGateForm.tsx:56` — `shadow-lg shadow-black/20` on the password pill, gate view.
- `src/components/FlickBook.tsx:110,118` — default Tailwind `shadow` on the prev/next circular nav buttons, script viewer.
- `src/app/globals.css:87-91` (`.text-shadow-hero`), applied in `src/components/landing/LandingCentered.tsx:34,42` to the title/tagline whenever a poster is set — a drop shadow for text-over-image legibility, gate view.
The card "elevation" elsewhere comes from `bg-surface` tone-stepping, not box-shadow (see item 1).

### 3. Gradient washes
- `src/components/landing/LandingCentered.tsx:20-21` — two stacked `bg-gradient-to-b`/`bg-gradient-to-t` scrims over the poster, gate view.
- `src/components/landing/LandingFullBleed.tsx:20`, `src/components/landing/LandingSplit.tsx:21` — the same pattern for the other two landing layouts (not on the default theme audited here, but reachable via `landingLayout`).
- `src/components/slate/SlateFilmCard.tsx:31` — `bg-gradient-to-t from-background via-background/40 to-transparent` over each film card's poster, slate-overview view.

### 4. All-caps eyebrow labels
The single most repeated pattern in the codebase — `uppercase tracking-[…]` or `uppercase tracking-wide/widest`, 50+ instances across 33 files. In the six audited views alone:
- Gate: "NORTHWIND PICTURES" (via the display serif, small-caps-styled), "PRIVATE DATA ROOM", "ENTER PASSWORD" (`LandingCentered.tsx:54`, `PasswordGateForm.tsx:52`)
- Room nav: "EXIT ROOM" (`RoomSidebar.tsx:65` / `RoomNav.tsx:41`)
- Room landing: "TEAM" (`[slug]/room/about/page.tsx:56`), role labels "DIRECTOR"/"PRODUCER" (`:67`)
- Script viewer: "EMAIL WATERMARKED COPY" button (`DocumentSectionView.tsx:63`)
- Finance panel / slate overview: "LOGLINE", "APPROXIMATE BUDGET", "IDEAL SHOOTING WINDOW", "FINANCE", every stat-tile label ("BUDGET", "% FINANCED", "EQUITY SOUGHT", "MINIMUM TICKET"…), "RING-FENCED", "BY FILM", "TEAM" (`slate/[slug]/[projectSlug]/page.tsx` ×8, `SlateFinanceOverview.tsx` ×3)
- Slate overview: "CURATED SLATE", "EXIT SLATE" (`SlateFilmGrid.tsx:33`, `SlateExitButton.tsx:16`)
- Gallery: "EXIT ROOM", nav tabs' underlying label case is sentence-case but the exit link is all-caps

### 5. Inter
`src/lib/loaded-fonts.ts:18-21` — `export const body = Inter({ variable: "--font-body", … })`, applied globally as `--font-sans` in `globals.css:22` and as `font-sans`/`antialiased` on `<body>` in `src/app/layout.tsx:28`. This is the body typeface on all six audited views (every paragraph, label, button, nav item) — only headings use the per-theme display serif/sans.

### 6. Fade-up animations
`src/app/globals.css:58-60` defines `.animate-fade-up`; applied on every element of the gate view's hero stack:
- `src/components/landing/LandingCentered.tsx:18,27,29,33,41,51` — poster Ken Burns pan, brand mark, divider, title, tagline, and the password card itself all animate in with staggered `animationDelay`.
- `src/components/slate/SlateLanding.tsx:17-40` — the same pattern, used for a slate's own unauthenticated landing (not one of the six screenshotted views, but same gate-page family).
Not present on room-landing, script-viewer, finance-panel, slate-overview, or gallery — confined to the two unauthenticated landing pages.

### 7. Numbered sections
**Not found anywhere in the UI.** Grepped for a literal numeral-prefixed section motif (`01`, `02`, "Step N", "Section N", "№") across `src/` — the only hits were code comments in two API route files, not UI copy. Nothing to remove here; noted as confirmed-absent rather than skipped.

### 8. Middle-dot separators
Present, but **only in admin-only surfaces**, not in the six viewer-facing views audited:
- `src/app/admin/page.tsx:50-51`, `src/app/admin/slates/page.tsx:47` — dashboard list rows ("… · /slug · N docs")
- `src/components/admin/FinancePanel.tsx:300-301` — the admin finance editor's source-type/status line
- `src/app/layout.tsx:15` — the `<title>` template (`%s · ${siteName}`), which is in every page's `<head>` but never rendered as visible body copy

## Summary

Every named default is present and verifiable except numbered sections (absent). The two highest-blast-radius items are **Inter** (one line in `loaded-fonts.ts`, but touches all body text everywhere) and the **uniform rounded-card recipe** (border + `bg-surface` + radius, reused without variation for team bios, finance stats, gallery tiles, and film cards alike — nothing currently distinguishes a "gallery wall" frame from a "form card" from a "data tile"). Step 2 addresses the token-level items (color, type, focus) without touching this component-level repetition; the gradient washes, fade-up animations, eyebrow-label casing, and card recipe itself are component/layout work for a later step.
