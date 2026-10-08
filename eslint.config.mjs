import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js route/page paths contain literal "[id]"-style segments, but
// ESLint's `files` globs treat [...] as a glob character class — escape
// the brackets so these patterns match the literal directory names
// instead of "a single character that is i, d, or slug".
function literalGlob(path) {
  return path.replace(/[[\]]/g, (c) => `\\${c}`);
}

// Files allowed to import the raw Prisma singleton (src/lib/db.ts) and use
// $queryRaw/$executeRaw directly, instead of going through tenantDb
// (src/lib/tenant-db.ts) — per docs/multi-tenancy-plan.md §4, revision 2:
// auth, public room/slate access helpers (never company-aware — scoped by
// slug and a live sessionVersion check, not companyId), and tenant-db
// itself (which necessarily imports the raw client it wraps).
const RAW_PRISMA_ALLOWLIST = [
  // Auth — operates before any company context exists.
  "src/app/api/admin/login/route.ts",
  "src/app/api/admin/2fa/confirm/route.ts",
  "src/app/api/admin/2fa/setup/route.ts",
  "src/app/api/admin/2fa/verify/route.ts",
  "src/lib/totp.ts",
  "src/lib/totp.test.ts",
  "src/lib/rate-limit.ts",
  "src/lib/rate-limit.test.ts",
  "src/lib/room-session.test.ts",
  // Public room/slate access — unauthenticated-until-password-checked,
  // scoped by slug, not company.
  "src/app/[slug]/page.tsx",
  "src/app/[slug]/room/about/page.tsx",
  "src/app/[slug]/room/gallery/page.tsx",
  "src/app/[slug]/room/layout.tsx",
  "src/app/slate/[slug]/page.tsx",
  "src/app/slate/[slug]/[projectSlug]/page.tsx",
  "src/app/api/documents/[id]/download/link/route.ts",
  "src/app/api/documents/[id]/download/route.ts",
  "src/app/api/documents/[id]/file/route.ts",
  "src/app/api/gallery/[id]/file/route.ts",
  "src/app/api/projects/[slug]/logo/route.ts",
  "src/app/api/projects/[slug]/poster/route.ts",
  "src/app/api/room/[slug]/auth/route.ts",
  "src/app/api/slate/[slug]/auth/route.ts",
  "src/lib/access.ts",
  "src/lib/access.test.ts",
  "src/lib/documents.ts",
  "src/lib/gallery.ts",
  "src/lib/get-section-documents.ts",
  "src/lib/leads.ts",
  "src/lib/require-room-access.ts",
  "src/lib/require-slate-film-access.ts",
  "src/lib/room-availability.ts",
  "src/lib/room-token.ts",
  "src/lib/slate-token.ts",
  "src/proxy.ts",
  "src/room-access.integration.test.ts",
  // tenant-db itself.
  "src/lib/tenant-context.ts",
  "src/lib/tenant-context.test.ts",
  "src/lib/tenant-db.ts",
  "src/lib/tenant-db.test.ts",
  // Bootstrap route — runs before any admin session or company exists;
  // guarded by its own NODE_ENV === "production" check instead.
  "src/app/api/admin/seed/route.ts",
];

// Still-unmigrated admin routes and pages. This is NOT an allowlist in the
// same sense as above — every entry here is meant to come OFF this list
// as its own commit moves it onto tenantDb, not stay on it. It exists
// only so this rule can ship now (per revision 2) without breaking
// `next build` (which runs ESLint) before that migration lands. See
// docs/multi-tenancy-plan.md §4/§7 for the batch-by-batch migration order.
const UNMIGRATED_ADMIN_ROUTES = [
  "src/app/admin/page.tsx",
  "src/app/admin/fx-rates/page.tsx",
  "src/app/admin/projects/[id]/page.tsx",
  "src/app/admin/slates/page.tsx",
  "src/app/admin/slates/[id]/page.tsx",
  "src/app/api/admin/fx-rates/route.ts",
  "src/app/api/admin/fx-rates/[id]/route.ts",
  "src/app/api/admin/projects/route.ts",
  "src/app/api/admin/projects/[id]/route.ts",
  "src/app/api/admin/projects/[id]/documents/route.ts",
  "src/app/api/admin/projects/[id]/documents/[docId]/route.ts",
  "src/app/api/admin/projects/[id]/documents/confirm/route.ts",
  "src/app/api/admin/projects/[id]/documents/presign/route.ts",
  "src/app/api/admin/projects/[id]/downloads/route.ts",
  "src/app/api/admin/projects/[id]/finance/sources/route.ts",
  "src/app/api/admin/projects/[id]/finance/sources/[sourceId]/route.ts",
  "src/app/api/admin/projects/[id]/gallery/route.ts",
  "src/app/api/admin/projects/[id]/gallery/[itemId]/route.ts",
  "src/app/api/admin/projects/[id]/gallery/confirm/route.ts",
  "src/app/api/admin/projects/[id]/gallery/presign/route.ts",
  "src/app/api/admin/projects/[id]/logo/route.ts",
  "src/app/api/admin/projects/[id]/poster/route.ts",
  "src/app/api/admin/projects/[id]/references/route.ts",
  "src/app/api/admin/projects/[id]/references/[refId]/route.ts",
  "src/app/api/admin/projects/[id]/revoke-sessions/route.ts",
  "src/app/api/admin/slates/route.ts",
  "src/app/api/admin/slates/[id]/route.ts",
  "src/app/api/admin/slates/[id]/projects/route.ts",
  "src/app/api/admin/slates/[id]/projects/[projectId]/route.ts",
  "src/app/api/admin/slates/[id]/revoke-sessions/route.ts",
];

const NO_RAW_PRISMA_RULES = {
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@/lib/db",
          importNames: ["prisma"],
          message:
            'Import tenantDb from "@/lib/tenant-db" instead of the raw prisma client — every tenant-model query must go through company scoping. If this file is a deliberate exception (auth, public room/slate access, tenant-db itself, or a route not yet migrated), add it to the allowlist in eslint.config.mjs instead of disabling this rule inline.',
        },
      ],
    },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector:
        "MemberExpression[property.name=/^\\$(queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)$/]",
      message:
        "Raw SQL ($queryRaw/$executeRaw and their Unsafe variants) bypasses tenant scoping entirely — restricted to the same allowlist as the raw prisma import (see eslint.config.mjs).",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, unminified copy of the pdfjs worker (see scripts/copy-pdf-worker.mjs)
    "public/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: NO_RAW_PRISMA_RULES,
  },
  {
    files: [...RAW_PRISMA_ALLOWLIST, ...UNMIGRATED_ADMIN_ROUTES].map(literalGlob),
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
]);

export default eslintConfig;
