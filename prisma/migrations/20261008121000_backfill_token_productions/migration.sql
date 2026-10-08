-- Idempotent backfill: creates the "Token Productions" company (if not
-- already present) and backfills every nullable companyId column to it.
-- Every statement below is guarded (ON CONFLICT DO NOTHING / WHERE
-- "companyId" IS NULL), so this migration is safe to re-run — per the
-- requirement to re-run it immediately before the future migration that
-- flips companyId to NOT NULL, once every admin route is on the
-- tenant-scoped client.
--
-- Fixed id, not prisma.company.create()'s auto-generated cuid, so this
-- migration is reproducible and so the DEFAULTs below can reference it
-- literally.
INSERT INTO "Company" (id, name, "createdAt", "updatedAt")
VALUES ('cktokenproductions0001', 'Token Productions', now(), now())
ON CONFLICT (id) DO NOTHING;

UPDATE "Project" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "Slate" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "SlateProject" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "Document" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "GalleryItem" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "ReferenceLink" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "FinanceSource" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "FxRate" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;
UPDATE "DocumentDownload" SET "companyId" = 'cktokenproductions0001' WHERE "companyId" IS NULL;

-- Safety-net DB-level DEFAULTs — deliberately not mirrored into
-- schema.prisma's @default() (a multi-tenant schema shouldn't hardcode one
-- company's id into its application-level model). companyId stays
-- nullable at the schema level: the future migration that flips it to
-- NOT NULL still waits until every admin route is on the tenant-scoped
-- client. Without this DEFAULT, any row inserted by a still-unmigrated
-- admin route (which doesn't set companyId at all) would stay companyId =
-- NULL — and Prisma's composite (parentId, companyId) relation join would
-- then silently fail to resolve that row's parent relation on read, since
-- SQL's NULL = NULL is never true even though the plain scalar FK
-- (parentId) matches correctly. Confirmed empirically (a GalleryItem's
-- `include: { project: true }` returned null for `project` pre-backfill,
-- despite a valid matching projectId) before adding this DEFAULT. This is
-- a transitional bridge for the single-tenant window only — once routes
-- migrate onto the tenant-scoped client (a later commit) every create
-- call supplies companyId explicitly, making this DEFAULT dead weight
-- that Migration C can drop when it flips the column to NOT NULL.
ALTER TABLE "Project" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "Slate" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "SlateProject" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "Document" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "GalleryItem" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "ReferenceLink" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "FinanceSource" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "FxRate" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
ALTER TABLE "DocumentDownload" ALTER COLUMN "companyId" SET DEFAULT 'cktokenproductions0001';
