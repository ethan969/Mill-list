# Mill List — film data room template

A private, password-protected data room that presents as a clean, interactive
pitch packet. Built to be reused for every film you produce: one admin panel,
unlimited projects, each with its own URL, password and branding.

## What it does

- **Landing page** — shows only the film's title and production company.
  Nothing else is visible until the password is entered.
- **Data room** with six sections: **Script**, **Creative Deck**,
  **Financials**, **About Us**, **Production Plan**, **Gallery & References**.
- **Flick-through viewer** for the four document sections — PDFs render
  page-by-page in the browser (keyboard arrows, swipe, page slider), nothing
  is downloadable by default.
- **Watermarked downloads, delivered by email** — visitors enter their
  email; the server stamps a fresh copy of the PDF with their email, the
  project name and a timestamp (tiled diagonally across every page), then
  emails them a signed, expiring link to it. Nothing downloads straight into
  their current browser — it lands in their inbox, addressed to them, which
  is also what makes the watermark meaningful. Every request is logged as a
  lead, and the Leads tab shows whether the email actually sent and whether
  the link was opened.
- **Adaptable visual language per project** — six curated color themes tuned
  for different genres, six titling fonts pickable independently of theme,
  an accent-color override, three landing-page layouts (centered wordmark,
  split poster, full-bleed one-sheet) and two room layouts (top tabs or a
  sidebar file-browser), plus a logo upload that replaces the plain
  production-company text. Every combination applies instantly from the
  admin panel.
- **Admin panel** (`/admin`) — create a project, upload documents per
  section, manage the gallery and reference links, write the About Us copy,
  set the theme/logo/poster/password, publish/unpublish, and export the lead
  list as CSV.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma ·
S3-compatible object storage (falls back to local disk in dev) · pdf-lib
(watermarking) · react-pdf (viewer) · jose (signed cookie sessions) · Resend
(download emails).

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up Postgres** and copy `.env.example` to `.env`, filling in
   `DATABASE_URL` and a random `SESSION_SECRET` (`openssl rand -base64 48`).

3. **Run migrations**

   ```bash
   npm run db:migrate
   ```

4. **Create your admin account** — set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in
   `.env`, then either run:

   ```bash
   npm run seed:admin
   ```

   or, especially useful on a deployed environment where you don't have a
   terminal open against the database (e.g. right after a Vercel deploy),
   visit `/api/admin/seed?token=<your SESSION_SECRET>` in a browser. Both do
   the same thing — create the admin account if it doesn't exist yet, or
   reset its password to match `ADMIN_PASSWORD` if it does — and are safe to
   re-run any time you want to reset the admin password. The route is gated
   by `SESSION_SECRET` itself (compared against the `token` query param), so
   only someone with access to your project's environment variables can use
   it, and it never accepts credentials from the request — only from
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` already configured on the server.

5. **Start the app**

   ```bash
   npm run dev
   ```

   Sign in at `/admin/login`, click **New project**, and you're in.

Object storage is optional for local development — if `STORAGE_*` env vars
aren't set, uploaded files are written to `./storage` on disk. Fill in the
`STORAGE_*` variables (any S3-compatible provider — Cloudflare R2 is a good,
cheap default) before deploying anywhere with ephemeral or serverless disk.

Email delivery is also optional for local development — if `RESEND_API_KEY`
isn't set, requested download links are logged to the server console instead
of emailed, so the app stays fully usable without a provider account. Set
`RESEND_API_KEY` and `EMAIL_FROM` (with a domain verified in
[Resend](https://resend.com)) before going live, or swap `src/lib/email.ts`
for another provider — it's a single function.

## Launching a new film

Every project is created from the admin panel — there's no per-film code to
touch:

1. `/admin` → **New project** → give it a title, production company, URL
   slug and password.
2. Go through the tabs: upload the **Script**, **Creative Deck**,
   **Financials** and **Production Plan** PDFs, write **About Us**, add
   **Gallery** stills/video and **Reference** links.
3. On the **Details** tab, pick a **visual theme** and **titling font** that
   fit the film (see below), optionally override the accent color, choose a
   **landing page layout** and **data room navigation** style, and upload a
   **logo** and landing-page **poster**.
4. Flip **Publish** on. Share `yourdomain.com/<slug>` and the password with
   whoever needs access.
5. Check the **Leads** tab any time to see who's requested what, and whether
   each email actually sent and was opened.

### Visual themes

Each project picks one of six built-in themes — a color palette paired with
a titling font, tuned for a genre — rather than a fully freeform style
editor. That's deliberate: a producer can get a distinct, considered look in
one click without needing to make ten separate design decisions (or being
able to accidentally pick unreadable colors). The set:

| Theme | Feel |
| --- | --- |
| Midnight Gold | Prestige drama — near-black, warm gold, elegant serif |
| Blood Moon | Horror & thriller — near-black, deep red, dramatic serif |
| Neon Nights | Sci-fi & action — navy-black, cyan, geometric sans |
| Paper & Ink | Indie & period drama — warm cream, burgundy, classic serif |
| Sundance | Indie comedy/dramedy — warm charcoal-brown, amber, soft serif |
| Mono Noir | Crime & documentary — high-contrast black/white, bold condensed titling |

An optional accent-color override sits on top of whichever theme you pick,
for when you want the palette but a different brand color. Add a seventh
theme by editing `src/lib/themes.ts` (colors) and, if it needs a new font,
loading it once in `src/app/layout.tsx` the same way the existing six are.

### Fonts, independently of theme

Each theme suggests a titling font, but the **Titling font** picker on the
Details tab can override it with any of the same six fonts regardless of
which color theme is active — e.g. Blood Moon's palette with Bebas Neue's
condensed caps instead of its default Playfair Display. The font applies to
the film title and every section heading, in both the landing page and the
room, via a single `--font-display` CSS variable
(`src/lib/themes.ts#themeStyleVars`). Adding an eighth font means loading it
once in `src/app/layout.tsx` and adding an entry to `FONTS` in
`src/lib/themes.ts`.

### Layouts

Two independent layout choices, each a small, deliberate set rather than a
drag-and-drop builder:

- **Landing page** (`src/components/landing/`) — **Centered** (a wordmark
  title over faint poster art), **Split** (poster fills one half of the
  screen, title and password form the other), or **Full Bleed** (poster
  fills the whole screen like a one-sheet, title anchored over the bottom
  with a strong gradient).
- **Data room navigation** (`RoomNav` / `RoomSidebar`) — **Top Nav** (section
  tabs across the top, the original pitch-deck feel) or **Sidebar** (a
  vertical section list down the left, closer to a document-library feel).

Both switch instantly from the admin panel and combine freely with any
theme/font/accent choice.

## How access control works

- The **data room password** is one password per project (set in the admin
  panel), hashed with bcrypt. Entering it sets a signed, httpOnly cookie
  scoped to that project — no email is required just to browse the room.
- **Downloads** are the only place an email is collected. The server emails
  that address a link to a freshly watermarked copy rather than downloading
  it straight into the requester's current browser — the link carries its
  own signed, 7-day token (`src/lib/auth.ts`'s download token), independent
  of the room session, since it may be opened on a different device. Every
  request is stored against that document in the `Leads` tab; it does not
  grant any additional room access.
- The **admin panel** is a separate login, protected by `proxy.ts` and by
  each admin API route independently checking the session (defense in
  depth), so it can't be reached by guessing a project password.
- Every document/gallery file is served through an API route that checks the
  requester's session cookie against that specific project before streaming
  any bytes — files are never publicly reachable by URL.

Password attempts are rate-limited in memory per IP. That's fine for a
single server instance; if you run multiple instances behind a load
balancer, swap `src/lib/rate-limit.ts` for a shared store (e.g. Redis).

## Known limitations / things to revisit before scaling this up

- **Local disk storage fallback** (`./storage`) is for development only —
  it will not survive redeploys on most serverless hosting. Configure
  `STORAGE_*` before going live.
- **Large video uploads** go through a Next.js API route (`request.formData()`),
  which is simple but subject to your host's request body size limit (this
  can be small on serverless platforms). If you need to host large sizzle
  reels, either raise that limit on your platform or move gallery video
  uploads to presigned direct-to-storage uploads.
- **Rate limiting** is in-memory and per-instance (see above).
- **About Us** currently supports plain-text/paragraph copy and a text-only
  team list (no individual headshots) to keep the asset model simple —
  extend `GalleryItem`/`Project` if you want per-person photos.
- **Themes are a curated, hardcoded set** (`src/lib/themes.ts`) rather than a
  freeform theme builder, by design — see "Visual themes" above. Adding one
  is a small code change, not a database migration.
- **Resend's free tier** requires sending from a subdomain you've verified
  with them (or their shared `onboarding@resend.dev` sender for testing
  only). Set `EMAIL_FROM` to an address on your own verified domain before
  relying on this for real investor outreach.

## Project structure

```
prisma/schema.prisma        Project, Document, GalleryItem, ReferenceLink,
                             DocumentDownload (leads), AdminUser
src/lib/                    db, auth (sessions + download tokens), storage
                             (S3/local), watermark (pdf-lib), email (Resend),
                             themes, validation, sections
src/app/[slug]/              public landing page + password gate
src/app/[slug]/room/         the six data-room sections
src/app/admin/                admin panel (project CRUD, uploads, leads)
src/app/api/                  everything above is backed by route handlers
                             here — public room auth, protected file
                             streaming, emailed watermarked downloads, admin
                             CRUD
src/proxy.ts                 fast-fail auth guard for /admin and /api/admin
```
