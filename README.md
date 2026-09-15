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
- **Watermarked downloads** — visitors enter their email, and the server
  stamps a fresh copy of the PDF with their email, the project name and a
  timestamp (tiled diagonally across every page) before it downloads. Every
  download is logged as a lead.
- **Admin panel** (`/admin`) — create a project, upload documents per
  section, manage the gallery and reference links, write the About Us copy,
  set the poster image and password, publish/unpublish, and export the lead
  list as CSV.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma ·
S3-compatible object storage (falls back to local disk in dev) · pdf-lib
(watermarking) · react-pdf (viewer) · jose (signed cookie sessions).

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
   `.env`, then:

   ```bash
   npm run seed:admin
   ```

5. **Start the app**

   ```bash
   npm run dev
   ```

   Sign in at `/admin/login`, click **New project**, and you're in.

Object storage is optional for local development — if `STORAGE_*` env vars
aren't set, uploaded files are written to `./storage` on disk. Fill in the
`STORAGE_*` variables (any S3-compatible provider — Cloudflare R2 is a good,
cheap default) before deploying anywhere with ephemeral or serverless disk.

## Launching a new film

Every project is created from the admin panel — there's no per-film code to
touch:

1. `/admin` → **New project** → give it a title, production company, URL
   slug and password.
2. Go through the tabs: upload the **Script**, **Creative Deck**,
   **Financials** and **Production Plan** PDFs, write **About Us**, add
   **Gallery** stills/video and **Reference** links, set an accent color and
   poster image.
3. Flip **Publish** on. Share `yourdomain.com/<slug>` and the password with
   whoever needs access.
4. Check the **Leads** tab any time to see who's downloaded what.

## How access control works

- The **data room password** is one password per project (set in the admin
  panel), hashed with bcrypt. Entering it sets a signed, httpOnly cookie
  scoped to that project — no email is required just to browse the room.
- **Downloads** are the only place an email is collected. It's baked into
  the watermark and stored against that download in the `Leads` tab; it does
  not grant any additional access.
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

## Project structure

```
prisma/schema.prisma        Project, Document, GalleryItem, ReferenceLink,
                             DocumentDownload (leads), AdminUser
src/lib/                    db, auth (sessions), storage (S3/local),
                             watermark (pdf-lib), validation, sections
src/app/[slug]/              public landing page + password gate
src/app/[slug]/room/         the six data-room sections
src/app/admin/                admin panel (project CRUD, uploads, leads)
src/app/api/                  everything above is backed by route handlers
                             here — public room auth, protected file
                             streaming, watermarked downloads, admin CRUD
src/proxy.ts                 fast-fail auth guard for /admin and /api/admin
```
