# Design tokens — step 2

Tokens only, per the brief — no layout/component-structure changes. Screenshots in this folder use the same six views, fixture project/slate, and 390px/1440px widths as `design/before/`, so they're a direct before/after comparison.

## What changed

**Color tokens** (`src/app/globals.css`): the platform palette is now Stock `#f2f2ee` (background), Graphite `#1d2024` (text), Pencil `#6b6f75` (secondary), Edge `#d5d6d1` (hairlines), plus a new Screen `#000000` token reserved for letterboxing. `--surface`/`--surface-raised` now equal Stock rather than a lighter tonal step — a card's boundary comes from its Edge hairline border alone, not a fill-color difference (see `design/before/audit.md` item 1).

**`src/lib/themes.ts`**: `themeStyleVars()` now only overrides `--accent`, `--accent-foreground`, and `--font-display`. It no longer touches background/surface/surface-raised/foreground/muted/border — those are fixed and universal across every project/slate regardless of theme, matching the brief's "accent from the room theme" (room display fonts work the same way already, and are genuinely unchanged). A `Theme`'s own `colors.background/surface/...` fields still exist and are used only as the admin theme-picker's preview-swatch data — they no longer apply to any real page.

**Fonts** (`src/lib/loaded-fonts.ts`): `Inter` → `Schibsted Grotesk` as the platform typeface (`--font-body`/`font-sans`, unchanged variable name, so no component className changes were needed anywhere else). Added `Courier Prime` (`--font-courier-prime` → the `font-mono` theme token), applied only on the script viewer via a new `monospace` prop threaded through `DocumentSectionView` → `FlickBook` (title, the document-switcher pills, the "Email watermarked copy" button, and the page counter). The six curated display fonts are untouched.

**Type scale**: a strict 1.25 (major third) ratio from a 16px base, overriding Tailwind's default (non-modular) `--text-*` tokens. Same utility names throughout (`text-xs` … `text-7xl`), so no component changed.

**Tabular figures**: *not* applied globally — see "A mistake, caught and fixed" below. Applied via Tailwind's built-in `tabular-nums` utility directly on the actual numeric displays: every finance stat tile (admin, slate overview, per-film page), the capital-stack chart's legend amounts, the FX-rate admin list, and the script viewer's page counter.

**Line length**: Tailwind's built-in `max-w-prose` (65ch, under the 70-character ask) now caps every genuine prose paragraph in the six views and their siblings — taglines on all three landing layouts plus the slate landing page, the room's About Us body copy, a film's logline on its slate page, the slate overview's about copy, and the Finance panel's recoupment note and disclaimer.

**Visible keyboard focus**: a global `:focus-visible` rule (2px solid accent, 2px offset), with an `!important` override specifically for `outline-none` form elements — several inputs across the app set `outline-none` and relied only on a border-color change (see `design/before/audit.md`), which isn't visible enough for keyboard navigation. This is one global CSS block; no component files were touched for this.

**The one named token applied inside a component**: `src/components/GalleryGrid.tsx`'s full-screen lightbox backdrop (`bg-black/85` → `bg-screen/85`) — the one real "letterbox" context in the six audited views, per the brief's explicit "Screen (letterbox only)" scope.

## A mistake, caught and fixed

My first pass set `font-variant-numeric: tabular-nums` globally on `body`, reasoning "tabular figures for all numbers" meant site-wide. Rendered against the actual fixture, this introduced a visible, spurious gap before periods and commas throughout ordinary prose in Schibsted Grotesk (compare a quick isolated test at `/tmp` during this session — removing the global rule removed the gap). I reverted the global rule and instead applied Tailwind's `tabular-nums` utility only to the elements that actually display numbers (listed above). Flagging this because it's exactly the kind of regression that's invisible in a diff and only shows up when you look at the rendered page — which is why this step's screenshots exist.

## Finding that needs a decision: accent-on-light contrast

Flipping the platform background from dark (every theme except Paper & Ink) to light Stock has a real consequence the brief's "accent from the room theme" doesn't address: **several curated accent colors were only ever designed for a dark background, and read poorly — in one case, invisibly — on Stock.**

Measured contrast ratios (accent as text/UI color against Stock `#f2f2ee`, WCAG formula):

| Theme | Accent | Ratio vs. Stock | WCAG AA text (4.5:1) |
|---|---|---|---|
| Mono Noir | `#e5e5e5` | **1.05:1** | Fail — effectively invisible (two near-identical light greys) |
| Neon Nights | `#35e0c9` | **1.48:1** | Fail |
| Sundance | `#e08a3c` | **2.38:1** | Fail |
| Midnight Gold (this fixture's theme, and the platform default) | `#c9a24b` | **2.14:1** | Fail |
| Blood Moon | `#b5342c` | **5.36:1** | **Pass** |
| Paper & Ink | `#7a2e2e` | **8.29:1** | **Pass** (already designed for a light cream background) |

All computed via the WCAG relative-luminance formula against Stock `#f2f2ee`. The two dark-red/burgundy accents (Blood Moon, Paper & Ink) are fine as-is; the four others — including Midnight Gold, the platform default — fail, with Mono Noir and Neon Nights unusable.

This is directly visible in `finance-panel-*.png` and `room-landing-*.png`: the gold "DIRECTOR"/"PRODUCER" role labels (`text-accent`) are noticeably washed out compared to the `before/` shots, where the same gold was bright against near-black. Mono Noir's accent (`#e5e5e5`, near-white) would be essentially unreadable against Stock (`#f2f2ee`) — two light greys on top of each other.

I implemented the brief exactly as specified rather than inventing new accent values on my own judgment — picking replacement colors for the six themes is a content decision, not a token-system one, and "accent from the room theme" was explicit. But this is a real, measured, visible regression, not a style nitpick, so it needs a decision before this ships: either the six themes' accent values need revisiting for light-background contrast (possibly a lighter/darker accent variant depending on use — text vs. a filled button already fares differently, since accent-on-accent-foreground fills stay high-contrast regardless), or `--accent` needs a per-surface treatment I haven't built. Flagging rather than guessing.

## Known follow-up (not fixed here, by design)

- The admin theme-picker's swatch preview (`src/components/admin/DetailsPanel.tsx`) still renders each theme's old `colors.background` as a preview fill — now misleading, since no theme actually applies that color to a real page anymore. Left alone: fixing it is a component/JSX change, out of this step's "tokens only" scope.
- Everything inventoried in `design/before/audit.md` that isn't a token (rounded-card recipe, soft shadows elsewhere, gradient washes, fade-up animations, eyebrow-label casing, middle dots) is untouched, as instructed.

## Verification

- `npx tsc --noEmit`, `npx eslint src` — clean.
- `npx vitest run` — 110/110 passing (includes a full production build via the real-server integration suite).
- All twelve step2 screenshots captured against a real `next start` server, authenticated via the real room/slate password flows, same fixture content as `design/before/`.
