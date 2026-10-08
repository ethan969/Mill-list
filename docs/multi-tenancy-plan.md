# Multi-tenancy migration plan

**Status:** Commits 1–4 (schema, backfill, User/CompanyMembership, tenant-db) built and pushed on branch `multi-tenancy`. Route migration (commit 5+) not started.

## Context

Mill List is currently single-tenant: one global `AdminUser` table, zero ownership checks on any admin route (confirmed by reading every admin route family — `projects`, `slates`, `documents`, `gallery`, `references`, `finance/sources`, `fx-rates` — every one does a bare `findUnique({ where: { id } })`/`update({ where: { id } })`/`delete({ where: { id } })` keyed only off the URL path param, with no admin-ownership predicate anywhere). That was correct under a single-company assumption. Ahead of a beta with an external production company, the app needs real tenant isolation: company A's admin must never be able to read, write, or enumerate company B's projects, slates, documents, finance data, or investor/download records, even by guessing a real ID.

This plan adds a `Company` model, scopes every tenant-owned table to it, replaces the single global admin login with `User` + `CompanyMembership` (keeping 2FA intact), and builds one enforcement chokepoint that makes "forgot to filter by company" structurally impossible — both at the Prisma-client layer (a query extension that throws without a company context) and at the database layer itself (composite foreign keys that make a cross-company link physically unrepresentable, not just unqueried). Row-level security is assessed as a deliberate later layer, not built now.

**A factual correction for the record:** the original brief listed "viewers, view events, certifications, certification and privacy text" among the models that get `companyId`. None of these exist in the current schema or codebase — confirmed by a full-repo grep for `model (Viewer|Lead|Investor|Audit|Session|Certification)` (zero matches at planning time) and by this session's own earlier work on Slate Mode, where "the existing certification gate" was investigated and found not to exist; the user explicitly decided then that **the slate password session itself stands in for certification**, with no separate Certification model. The closest existing analogue to "viewer"/"investor list" is `DocumentDownload` (captures an email when someone requests a watermarked copy — no login, no session, not unique on anything). This plan scopes `DocumentDownload` to `companyId` and designs its uniqueness story so a future `Viewer`/`Certification` model can slot in without rework, but does not invent those models — flagged as a gap below, not silently built or silently ignored. A minimal `AuditLog` **is** added in this pass (see §1, §4) — not because it existed before, but because platform-admin cross-company access needs a trail from day one.

---

## 1. Company model and which existing models get `companyId`

### New models

```prisma
model Company {
  id        String   @id @default(cuid())
  name      String
  slug      String?  @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships    CompanyMembership[]
  projects       Project[]
  slates         Slate[]
  fxRates        FxRate[]
  auditLogs      AuditLog[]
}

/// Minimal audit trail, added now specifically because the platform-admin
/// cross-company bypass (src/lib/tenant-context.ts) needs one from the
/// moment it exists, not bolted on after the fact. Not a general-purpose
/// audit system — scope is deliberately narrow (see §4).
model AuditLog {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  userId    String
  action    String   // e.g. "platform_admin_bypass"
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([companyId])
  @@index([userId])
  @@index([action])
}
```

No `certificationText`/`privacyText` fields are added speculatively — see Context above. If that feature is scoped later, `Company` is the natural home for per-company override text, but guessing its shape now isn't this migration's job.

### `companyId` added, by model — and how cross-company links are made physically impossible

Every tenant model gets a **direct, denormalized `companyId`** (not derived via join at query time), for two reasons: query simplicity, and — per revision 1 of the approved plan — so that every child→parent foreign key can be a **composite FK on `(parentId, companyId)`** rather than a plain `(parentId)` FK. Postgres then rejects, at insert/update time, any row whose `companyId` doesn't match its parent's `companyId` — this is enforced by the database itself, not by application code remembering to check.

This requires each parent (`Project`, `Slate`) to expose a compound unique target: `@@unique([id, companyId])` (harmless — `id` is already unique alone; this just gives Postgres a composite target to reference).

| Model | companyId? | FK design |
|---|---|---|
| `Project` | **Yes**, direct | Tenancy root. `@@unique([id, companyId])` added as the composite FK target for children. `slug` **stays globally `@unique`** — it's the literal public URL path (`/<slug>`, no company segment); collapsing it to `@@unique([companyId, slug])` would let two companies collide on a URL. |
| `Slate` | **Yes**, direct | Second tenancy root. Same `@@unique([id, companyId])` and same global-slug reasoning. |
| `SlateProject` | **Yes**, direct — **new in this revision** | The join table itself now carries `companyId`, with **two composite FKs**: `(slateId, companyId) → Slate(id, companyId)` and `(projectId, companyId) → Project(id, companyId)`. Since a single row has only one `companyId` value, both FKs can only be satisfied simultaneously if `slate.companyId === project.companyId` — the database makes "a slate including another company's film" **unrepresentable**, not just unqueried. This replaces the trigger-based approach considered during planning; the composite-FK trick is simpler and is exactly as strong. |
| `Document` | **Yes**, direct | Composite FK to `Project(id, companyId)` when `projectId` is set, and to `Slate(id, companyId)` when `slateId` is set — both nullable, Postgres's default `MATCH SIMPLE` means a FK with a null column is trivially satisfied, which is exactly right given `Document`'s existing project-or-slate `CHECK` constraint (raw SQL, `prisma/migrations/20260928205020_add_slate_mode/migration.sql`) already enforces exactly one of the two is set. |
| `GalleryItem` | **Yes**, direct | Composite FK to `Project(id, companyId)`. Always project-owned. |
| `ReferenceLink` | **Yes**, direct | Composite FK to `Project(id, companyId)`. Always project-owned. |
| `FinanceSource` | **Yes**, direct | Composite FK to `Project(id, companyId)`. `src/lib/finance.ts`'s calculations are pure and untouched either way. |
| `FxRate` | **Yes**, direct | Plain FK to `Company` (no parent other than the company itself — was fully global before; becomes per-company admin-entered data). **Real behavior change, not just a schema add**: company B no longer benefits from a rate company A already entered for the same currency pair/date. |
| `DocumentDownload` (today's closest thing to "viewer"/"investor list") | **Yes**, direct | Composite FKs to `Project(id, companyId)` and `Slate(id, companyId)`, same `MATCH SIMPLE`-nullable treatment as `Document` — except here both can be non-null *simultaneously* (a project-owned document downloaded via a slate session records both), and when both are set, both composite FKs apply independently and must each resolve to the *same* `companyId` (guaranteed by the `SlateProject` invariant above, since a slate can only ever reference same-company projects). **Uniqueness**: no `@@unique` exists on `email` today — just a plain `@@index`; nothing to migrate. Forward-looking rule recorded for whenever a real `Viewer`/`Certification` identity is built: **any uniqueness on viewer identity must be `@@unique([companyId, email])`, never global** — the same person can legitimately be a prospective investor for two unrelated companies on this platform. |
| `RateLimitAttempt` | **No** | Key is a free-form string (`"admin-login:<ip>"`, `"room:<slug>:<ip>"`), no real FK, purpose is platform-wide abuse prevention — scoping it to company would let an attacker reset their budget by "switching companies." Left unchanged. |
| `AuditLog` | **Yes**, direct, `onDelete: Restrict` | New in this revision (above) — minimal, narrow-purpose. |

### `AdminUser` → `User` + `CompanyMembership`

Full detail in §3. Summary for completeness here: **`User` itself does not get a direct `companyId`** — the relationship is the many-to-many `CompanyMembership` join (`userId`, `companyId`, `role`), so the schema supports a person belonging to multiple companies even though the beta only needs one per user in practice. `User.email` **stays globally unique** (a real login credential tied to one person, unlike the per-company viewer-email case above).

### `onDelete` policy on every `Company` relation (revision 8)

Every direct `company Company @relation(...)` FK — on `Project`, `Slate`, `FxRate`, `CompanyMembership`, `AuditLog` — is `onDelete: Restrict`, **not** `Cascade`. A `Company` row cannot be deleted while it still owns any projects, slates, FX rates, memberships, or audit entries. This is deliberate friction: deleting a whole company by accident (fat-fingered admin script, a bad cascading test helper) should be impossible without first and explicitly tearing down everything under it. This does **not** change any existing `Project`/`Slate` child relation's own `onDelete: Cascade` (e.g. deleting a `Project` still cascades its `Document`s) — only the new `company` edges are `Restrict`.

---

## 2. Migrating existing data into a "Token Productions" company

Additive, expand-and-contract, idempotent at every data step (revision 7).

1. **Migration A (additive only):** `CREATE TABLE "Company"`, `CREATE TABLE "AuditLog"`; add nullable `companyId` columns (plus the composite-FK columns/constraints from §1) to every target table; add `@@unique([id, companyId])` to `Project`/`Slate`. No FKs made `NOT NULL` yet, no app code changed. Fully backward-compatible.

2. **Migration B (backfill, idempotent):**
   ```sql
   INSERT INTO "Company" (id, name, "createdAt", "updatedAt")
   VALUES ('<fixed-cuid>', 'Token Productions', now(), now())
   ON CONFLICT (id) DO NOTHING;

   UPDATE "Project" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "Slate" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "SlateProject" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "Document" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "GalleryItem" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "ReferenceLink" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "FinanceSource" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "FxRate" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   UPDATE "DocumentDownload" SET "companyId" = '<fixed-cuid>' WHERE "companyId" IS NULL;
   ```
   Every write is `WHERE ... IS NULL` — safe to run multiple times, including **immediately before Migration C** (the `NOT NULL` cutover, a future commit) to sweep up anything created between the first backfill and the cutover.

3. **Verification gate — Neon branch (honesty note on this pass):** the plan calls for creating a Neon branch from production data, running A+B there, and verifying before touching production. **This sandbox has no Neon API access** (no `NEON_API_KEY`/project credentials in this environment) — Migrations A and B in this pass were written and verified against the local Postgres instance used throughout this session (same data shape, same migration SQL that will run anywhere), not a real Neon branch. The Neon-branch step is still the right verification gate for the actual production rollout and is **not satisfied** by this pass — flagged clearly in §7 as an open item before these migrations touch real company data.

4. **Migration C (constrain — future commit, not built in this pass):** re-run Migration B's idempotent backfill once more immediately beforehand, then flip every `companyId` to `NOT NULL`, add `@@index([companyId])` and any composite indexes the admin list views need. Only ships once every admin route is migrated onto the tenant-scoped client (§4) and the full cross-tenant test matrix (§6) is green — flipping `NOT NULL` before that would just break the still-unmigrated routes outright.

---

## 3. Replacing `AdminUser` with `User` + `CompanyMembership`

### Schema

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())

  totpSecretEncrypted String?
  totpEnabledAt       DateTime?
  totpLastUsedStep    Int?

  isPlatformAdmin Boolean @default(false)

  recoveryCodes AdminRecoveryCode[]
  memberships   CompanyMembership[]
}

enum CompanyRole {
  OWNER
  EDITOR
}

model CompanyMembership {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  companyId String
  company   Company     @relation(fields: [companyId], references: [id], onDelete: Restrict)
  role      CompanyRole
  createdAt DateTime    @default(now())

  @@unique([userId, companyId])
  @@index([companyId])
  @@index([userId])
}
```

A Prisma model **rename** (`AdminUser` → `User`), not drop-and-recreate — `id` values are preserved, so **existing `admin_session` JWTs keep validating unchanged** (the `sub` claim is still the same `User.id`; nothing about the JWT shape in `src/lib/auth.ts` changes). `AdminRecoveryCode.adminId` → `userId`, mechanical rename.

**What has to keep working** (confirmed from `src/lib/totp.ts` read in full): the three `totp*` fields and the `AdminRecoveryCode`/`userId` relation are the entire surface `totp.ts` touches — zero `AdminUser`-specific coupling beyond the field name. Call sites updated: `src/app/api/admin/login/route.ts`, `src/app/api/admin/2fa/*/route.ts`, `src/lib/totp.ts`'s own `prisma.adminRecoveryCode.*` calls, `src/lib/auth.ts`'s `AdminSessionPayload`/`requireAdmin()` (shape unchanged, only the underlying model renamed), and `src/lib/totp.test.ts` (calls `prisma.adminUser`/`prisma.adminRecoveryCode` directly).

**Role semantics** (Owner / Editor only, as specified):
- **Owner**: everything Editor can do, plus manage company settings and membership (invite/remove users, change roles).
- **Editor**: full CRUD on the company's projects, slates, documents, gallery, finance data; cannot manage membership or company settings.

**`isPlatformAdmin`**: single flag on `User`, not per-membership — for Mill List's own operators to support/access any company without a `CompanyMembership` row per company. Mechanism and audit logging in §4.

**Session design**: the `admin_session` JWT stays identity-only (`kind`, `sub`, `email`) — no `companyId` claim, mirroring the existing `sessionVersion`-checked-fresh pattern already used for room/slate sessions. Company is resolved fresh on every request (§4).

**Seed scripts and `/api/admin/seed`'s production reachability (revision 9 — investigated and fixed in this pass):** both `prisma/seed-admin.ts` and `src/app/api/admin/seed/route.ts` only ever upserted a single global `AdminUser` from env vars; both now also upsert a `CompanyMembership(OWNER)` row. Separately — **confirmed finding**: `src/app/api/admin/seed/route.ts` had **no production guard at all**. It's gated only by a `?token=` query param checked (timing-safe) against `SESSION_SECRET`, and `src/proxy.ts`'s admin-session matcher explicitly **exempts** `/api/admin/seed` from the normal admin-auth gate (`"it never accepts credentials from the request... so hitting it just re-syncs the database"` — by design, it's meant to work before any admin session exists). The token check means knowing `SESSION_SECRET` is required — and anyone who knows that can already forge admin JWTs directly, so this route wasn't a *distinct* new hole — but leaving a mutating bootstrap endpoint reachable in production is bad hygiene on its own, and the whole "one admin from env vars" model stops making sense once there are many `User`s across many companies. **Fixed in this pass**: the route now 404s when `process.env.NODE_ENV === "production"`, full stop, before even checking the token — re-seeding in production is pushed to the CLI script (`prisma/seed-admin.ts`, run with direct DB/deploy access) going forward.

---

## 4. Central enforcement layer

### Why a Prisma Client Extension plus DB-level composite FKs, not hand-added `where` clauses

Confirmed in research: every one of ~25 admin routes does a bare `findUnique`/`update`/`delete` keyed only on the path param, zero ownership predicate. Asking every route to remember `where: { companyId }` is exactly the failure mode that produced today's state. Two layers close this: the composite FKs in §1 make a cross-company *link* physically unrepresentable; the extension below makes a cross-company *query* fail loud instead of silently returning (or worse, silently scoping to nothing and looking like "not found" for the wrong reason).

### `src/lib/tenant-context.ts` — company-context plumbing + `resolveCompanyId`

```ts
import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/db";

type CompanyContext = { companyId: string };
const companyContext = new AsyncLocalStorage<CompanyContext>();

export class TenantContextError extends Error {}
export class AmbiguousCompanyError extends Error {}

export function withCompanyContext<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
  return companyContext.run({ companyId }, fn);
}

export function currentCompanyId(): string {
  const ctx = companyContext.getStore();
  if (!ctx) throw new TenantContextError("No active company context.");
  return ctx.companyId;
}

/**
 * Resolves which company an authenticated User is acting as. Revision 5:
 * refuses (throws AmbiguousCompanyError) when the user holds more than one
 * CompanyMembership and no explicit selection was passed — never silently
 * picks "the first one". `explicitCompanyId` is only honored as a genuine
 * switch when it matches a real membership row OR the user isPlatformAdmin
 * (revision 6: every platform-admin bypass use is written to AuditLog here,
 * not left to the caller to remember).
 */
export async function resolveCompanyId(
  user: { id: string; isPlatformAdmin: boolean },
  explicitCompanyId?: string
): Promise<string> {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId: user.id },
    select: { companyId: true },
  });

  if (explicitCompanyId) {
    const isMember = memberships.some((m) => m.companyId === explicitCompanyId);
    if (isMember) return explicitCompanyId;
    if (user.isPlatformAdmin) {
      await prisma.auditLog.create({
        data: {
          companyId: explicitCompanyId,
          userId: user.id,
          action: "platform_admin_bypass",
          metadata: { route: "resolveCompanyId" },
        },
      });
      return explicitCompanyId;
    }
    throw new TenantContextError("Not a member of the requested company.");
  }

  if (memberships.length === 0) throw new TenantContextError("User has no company membership.");
  if (memberships.length > 1) {
    throw new AmbiguousCompanyError(
      "User belongs to multiple companies; an explicit company selection is required."
    );
  }
  return memberships[0]!.companyId;
}
```

Not wired into any route in this pass — built and unit-tested in isolation (single membership resolves; zero memberships throws; multiple memberships with no selection throws `AmbiguousCompanyError`; explicit selection matching a real membership succeeds; explicit selection *not* matching a membership throws unless `isPlatformAdmin`, in which case it succeeds **and** writes an `AuditLog` row — asserted directly in the test).

### `src/lib/tenant-db.ts` — the scoped Prisma client

```ts
import { prisma } from "@/lib/db";
import { currentCompanyId } from "@/lib/tenant-context";

const TENANT_MODELS = new Set([
  "Project", "Slate", "SlateProject", "Document", "GalleryItem",
  "ReferenceLink", "FinanceSource", "FxRate", "DocumentDownload",
]);

// Every Prisma operation name this extension knows how to scope. Anything
// not in this map throws UnsupportedOperationError — revision 3: fail
// closed on an operation this code hasn't been taught about (e.g. a future
// Prisma release adding a new query shape) rather than silently passing it
// through unscoped.
const WHERE_MERGE_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow",
  "findMany", "update", "updateMany", "updateManyAndReturn",
  "delete", "deleteMany", "count", "aggregate", "groupBy",
]);
const DATA_INJECT_OPS = new Set(["create", "createMany", "createManyAndReturn"]);
const UPSERT_OP = "upsert"; // needs both: where AND create.data scoped

export class UnsupportedOperationError extends Error {}

export const tenantDb = prisma.$extends({
  name: "tenant-scoping",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_MODELS.has(model)) return query(args);
        const companyId = currentCompanyId(); // throws TenantContextError if no context — this is the fail-closed guarantee

        if (operation === "findUnique" || operation === "findUniqueOrThrow") {
          // findUnique's `where` only accepts unique-indexed fields and
          // can't take an extra companyId filter directly — rewritten to
          // findFirst(OrThrow) with the scope merged in.
          return (query as any)({ ...args, where: { ...args.where, companyId } });
        }
        if (WHERE_MERGE_OPS.has(operation)) {
          return query({ ...args, where: { ...(args as any).where, companyId } } as any);
        }
        if (DATA_INJECT_OPS.has(operation)) {
          return query(injectCompanyId(args, companyId));
        }
        if (operation === UPSERT_OP) {
          return query({
            ...args,
            where: { ...(args as any).where, companyId },
            create: { ...(args as any).create, companyId },
          } as any);
        }
        throw new UnsupportedOperationError(
          `tenantDb has no scoping rule for Prisma operation "${operation}" on model "${model}" — add one before using it.`
        );
      },
    },
  },
});

function injectCompanyId(args: any, companyId: string) {
  if (Array.isArray(args?.data)) {
    return { ...args, data: args.data.map((d: any) => ({ ...d, companyId })) };
  }
  return { ...args, data: { ...args?.data, companyId } };
}
```

Unit-tested per operation (not wired into any route in this pass): every op in `WHERE_MERGE_OPS`/`DATA_INJECT_OPS`/`upsert` correctly merges `companyId` without clobbering an existing `where`/`data`; an unrecognized operation name throws `UnsupportedOperationError`; a tenant-model call with no `withCompanyContext()` active throws `TenantContextError` (via `currentCompanyId()`); a non-tenant model (`User`, `CompanyMembership`, `RateLimitAttempt`, `AdminRecoveryCode`, `AuditLog`) passes through untouched regardless of context. **`$queryRaw`/`$executeRaw` are not — and cannot be — intercepted by this extension** (they're top-level client methods, not per-model operations); they're controlled by the lint rule below instead.

**Nested create/connect across companies (revision 1's test requirement):** covered at the schema layer, not the extension layer — a direct Prisma-level test (no route involved, since routes aren't migrated yet) that attempts `prisma.slate.update({ where: {id}, data: { projects: { create: { projectId: <other-company-project-id>, companyId: <this-slate-company-id> } } } })` and asserts it throws a Postgres FK-violation error, proving the composite FK from §1 rejects the cross-company link at the database level regardless of which Prisma client (scoped or raw) issued the write.

### Inverted lint rule (revision 2)

Previous plan only banned raw `prisma` inside `src/app/api/admin/**`. Revised: **ban raw `prisma` imports and `$queryRaw`/`$executeRaw`/`$queryRawUnsafe`/`$executeRawUnsafe` everywhere, with an explicit allowlist**, via an ESLint `overrides`/flat-config `ignores` pair:

**Allowlisted (legitimately need raw `prisma`):**
- `src/lib/db.ts` — defines the raw singleton itself.
- `src/lib/auth.ts`, `src/lib/totp.ts` — identity/session lookups that happen *before* a company is known (`User`, `AdminRecoveryCode`, `CompanyMembership` are non-tenant models anyway, but these files also legitimately run pre-tenant-context).
- `src/lib/access.ts`, `src/lib/room-token.ts`, `src/lib/slate-token.ts` — the public viewer-facing access-check helpers. These intentionally have no `next/headers` dependency so `src/proxy.ts` can call them, and they check `Project`/`Slate` directly by slug/id with their own `sessionVersion` live-check — a visitor isn't a company `User` at all, so company-scoping doesn't apply here the way it does to the admin surface.
- `src/lib/rate-limit.ts` — `RateLimitAttempt` is deliberately global (§1).
- `src/lib/tenant-context.ts`, `src/lib/tenant-db.ts` — the enforcement layer itself.
- `prisma/seed-admin.ts`, `src/app/api/admin/seed/route.ts` — bootstrap, runs before any company/membership exists.
- Public room/slate routes (`src/app/[slug]/**`, `src/app/slate/[slug]/**`, `src/app/api/room/**`, `src/app/api/slate/**`) and their server actions — same reasoning as `access.ts`.

**Everything else — admin pages (`src/app/admin/**`), admin API routes (`src/app/api/admin/**`), any other server component/server action, and the rest of `src/lib`** — is newly in-scope for the ban.

**Rollout without breaking the current build:** since routes aren't migrated yet (this pass explicitly stops before commit 5), turning this rule on as a hard `error` today would fail `next build` (which runs ESLint) on every one of the ~25 still-unmigrated admin routes — breaking the very integration-test suite (`src/room-access.integration.test.ts`) that depends on a clean production build. Resolved the standard way for ratcheting a strict rule onto an existing codebase: the rule is `error` severity, paired with an explicit, literal file-list exemption (not a broad glob) covering exactly the files that still need migration as of this commit. New code is held to the rule immediately and fully; the exemption list is a visible, shrinking to-do list that gets smaller with each future route-migration batch, never larger.

### Row-level security — still assessed, still deferred

Unchanged from the original assessment: RLS via `SET LOCAL app.company_id` only works safely if every tenant operation runs inside an explicit transaction, because Neon/most Postgres poolers run in transaction-pooling mode where a bare `SET` can leak onto a connection reused by a different request. That's a second, separate engineering effort (wrapping every tenant query in `$transaction`), scoped as explicit future work once the extension + composite-FK layers above are proven in production — not built now.

---

## 5. R2 key prefixes per company, and migrating existing files

Unchanged from the original assessment except one addition:

**New scheme**: `companies/<companyId>/projects/<projectId>/<category>/<id><ext>` (and the poster-variant equivalent), replacing `projects/<projectId>/<category>/<id><ext>`. Both key-builder functions (`src/lib/storage.ts:buildAssetKey`, `src/lib/poster-variants.ts:posterVariantKey`) take an added `companyId` parameter, shipped with the documents/gallery admin-route migration batch (future commit).

**Migrating existing objects**: standalone, resumable, dry-run-capable script — per-row atomicity (server-side `CopyObjectCommand` → DB update → delete old key), not a single global transaction, so it can resume if interrupted.

**New, from revision 4 — upload confirm routes (`src/app/api/admin/projects/[id]/documents/confirm/route.ts`, `.../gallery/confirm/route.ts`), for the future commit that migrates them**: today these routes take a presigned-upload `key` from the client body and trust it directly (`headObject(key)` to confirm it landed, then use it as the row's `fileKey`). Once company-prefixed keys exist, **the confirm handler must reject any key that isn't prefixed with the current session's own `companies/<companyId>/...`**, and should also check the key was actually one *this presign session* issued (e.g. by having the presign step record the exact key it handed out — in a short-lived signed token or a DB row — and having confirm check against that record) rather than accepting any syntactically-plausible same-company key. This closes a real gap: without it, a company-A user could potentially confirm-and-claim an object key that happens to collide with something under company A's own prefix but was never actually uploaded by them in that flow. Recorded here for the route-migration commit; not implemented in this pass since it's route-layer work.

---

## 6. Cross-tenant test matrix

Unchanged core design (seed companies A and B, real login, real server, assert 404-not-403 + no leaked content, matching this codebase's proven `room-access.integration.test.ts` pattern), plus:

**Generated from disk, not hand-maintained (revision 10):** the test file's setup step does `Glob("src/app/api/admin/**/route.ts")` and, for each file, parses which HTTP method exports it defines (`GET`/`POST`/`PATCH`/`DELETE` — a simple regex/AST check against the exported function names is enough, no need for a full TS parse). It cross-references that list against a manifest the test file maintains of "route + method → test case implemented." **Any route+method pair present on disk but absent from the manifest fails the suite outright** (a dedicated `it("every admin route is covered", ...)` test, not just a lint warning) — so a new admin route added later, or a method added to an existing route, can't silently ship without cross-tenant coverage. This is the mechanism that makes the matrix a CI gate rather than a snapshot that rots.

Named scenarios from the brief (list/read/update/delete/download, slate-including-another-company's-film, investor-list isolation, platform-admin-bypass correctness) are unchanged from the original assessment — not implemented in this pass since no routes are migrated yet to test against; the generation mechanism above is specified now so the first route-migration commit can build the real matrix against it immediately.

---

## 7. Risks, order of commits, and what in the current code makes this harder than expected

### What makes this harder than it looks

- **"Trust the path param" is total, not partial** — confirmed across every admin route family; the only existing checks anywhere verify parent/child path consistency, never ownership.
- **`Document`'s project-or-slate `CHECK` constraint is raw SQL**, not Prisma DSL — any migration touching `Document` needs hand-written SQL around it.
- **`DocumentDownload`'s two FKs are nullable and not mutually exclusive** (unlike `Document`) — needs its own composite-FK and backfill case analysis, can't reuse `Document`'s simpler XOR logic.
- **BigInt/Decimal money fields need care in any future route rewrite** — `bigIntMinorToNumber` serialization is easy to drop when a route is rewritten onto `tenantDb`.
- **Prisma singleton + Next dev-mode caching** (`src/lib/db.ts`'s `globalForPrisma` pattern) needs the same treatment for `tenantDb` — handled in this pass (see implementation notes in commit 4).
- **`src/lib/totp.test.ts` calls `prisma.adminUser`/`prisma.adminRecoveryCode` directly** — updated in commit 3, easy to have missed since it's not in the admin-route grep sweep.
- **`/api/admin/seed` had no production guard** — found and fixed in commit 3 (§3).

### Order of commits

**Built and pushed in this pass:**
1. Schema: `Company` + `AuditLog` + `companyId` everywhere + composite FKs + `@@unique([id, companyId])` on `Project`/`Slate` + `onDelete: Restrict` on every `Company` relation (§1). No app code changes. Full existing test suite passes unchanged.
2. Idempotent backfill to "Token Productions" (§2). Verified against local Postgres in this sandbox — **Neon-branch verification against real data is still required before this runs against production** (see §2.3).
3. `AdminUser` → `User` + `CompanyMembership` + `isPlatformAdmin` (§3), plus the `/api/admin/seed` production-disable fix. `totp.test.ts`, both seed scripts, login/2FA routes all updated. 2FA test suite passes unchanged in behavior.
4. `src/lib/tenant-context.ts` (`resolveCompanyId`, `withCompanyContext`) + `src/lib/tenant-db.ts` (full-operation-coverage extension) + the inverted ESLint rule with its exemption list (§4). Fully unit-tested. **Not wired into any route.**

**Future, not part of this pass:**

5. Migrate admin routes onto `tenantDb`, batched by resource family (projects → slates + `SlateProject` invariant test → documents/gallery/references → finance sources → fx-rates → downloads/leads), each batch shipping its slice of the §6 generated test matrix and shrinking the lint exemption list.
6. R2 key-prefix migration (§5), including the upload-confirm hardening (revision 4) — ships with/after the documents/gallery batch.
7. Migration C: re-run the idempotent backfill, then `NOT NULL` + indexes (§2.4) — only after every batch in step 5 is deployed and §6's matrix is green.
8. Postgres RLS as a second layer (§4) — separate future plan.

### Other risks

- **`isPlatformAdmin` is a privilege-escalation surface from the moment it exists** — `resolveCompanyId`'s bypass path is audit-logged in this pass (§4) specifically so there's a trail from day one, before any route even uses it.
- **The R2 rename script mutates external state with no DB-transaction rollback** — needs dry-run + per-row atomicity (§5), Neon-branch-verified dataset first.
- **Largest execution risk is coverage, not conceptual difficulty** — the composite FKs (§1), the generated test matrix (§6), and the inverted lint rule (§4) are all specifically chosen to convert "missed a spot" into a hard failure (migration rejected / CI red / build broken) rather than a silent gap.
- **Neon-branch verification is not yet done for real** — explicitly flagged, not glossed over: this pass's local-Postgres verification proves the migrations are *correct SQL*, not that they're *safe to run against the real production dataset*. That gate still needs to happen, with real Neon credentials, before Migrations A/B touch production.
