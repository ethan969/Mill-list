-- Multi-tenancy verification queries — read-only, safe to run against a
-- Neon branch (or production) as-is. Every query here is expected to
-- return 0 (or the row counts noted) after commits 1-2 (schema +
-- backfill) have been applied. Run each numbered block separately if
-- your SQL editor only shows the last statement's result.
--
-- Token Productions' fixed id, as created by
-- prisma/migrations/20261008121000_backfill_token_productions/migration.sql
-- and referenced by src/lib/tenancy.ts.

-- ============================================================
-- 1. Null companyId per tenant table — expect every count to be 0
-- ============================================================
SELECT 'Project'          AS table_name, count(*) FROM "Project"          WHERE "companyId" IS NULL
UNION ALL
SELECT 'Slate'            AS table_name, count(*) FROM "Slate"            WHERE "companyId" IS NULL
UNION ALL
SELECT 'SlateProject'     AS table_name, count(*) FROM "SlateProject"     WHERE "companyId" IS NULL
UNION ALL
SELECT 'Document'         AS table_name, count(*) FROM "Document"         WHERE "companyId" IS NULL
UNION ALL
SELECT 'GalleryItem'      AS table_name, count(*) FROM "GalleryItem"      WHERE "companyId" IS NULL
UNION ALL
SELECT 'ReferenceLink'    AS table_name, count(*) FROM "ReferenceLink"    WHERE "companyId" IS NULL
UNION ALL
SELECT 'FinanceSource'    AS table_name, count(*) FROM "FinanceSource"    WHERE "companyId" IS NULL
UNION ALL
SELECT 'FxRate'           AS table_name, count(*) FROM "FxRate"           WHERE "companyId" IS NULL
UNION ALL
SELECT 'DocumentDownload' AS table_name, count(*) FROM "DocumentDownload" WHERE "companyId" IS NULL
ORDER BY table_name;

-- ============================================================
-- 2. Rows not belonging to Token Productions — expect every count to be 0
--    (IS DISTINCT FROM also catches NULL, so this subsumes block 1 — if
--    anything shows up here but not above, it's a real second company or
--    a typo'd companyId, not just a missed backfill row.)
-- ============================================================
SELECT 'Project'          AS table_name, count(*) FROM "Project"          WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'Slate'            AS table_name, count(*) FROM "Slate"            WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'SlateProject'     AS table_name, count(*) FROM "SlateProject"     WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'Document'         AS table_name, count(*) FROM "Document"         WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'GalleryItem'      AS table_name, count(*) FROM "GalleryItem"      WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'ReferenceLink'    AS table_name, count(*) FROM "ReferenceLink"    WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'FinanceSource'    AS table_name, count(*) FROM "FinanceSource"    WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'FxRate'           AS table_name, count(*) FROM "FxRate"           WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
UNION ALL
SELECT 'DocumentDownload' AS table_name, count(*) FROM "DocumentDownload" WHERE "companyId" IS DISTINCT FROM 'cktokenproductions0001'
ORDER BY table_name;

-- ============================================================
-- 3. Company / User / CompanyMembership counts
-- ============================================================
SELECT 'Company'            AS table_name, count(*) FROM "Company"
UNION ALL
SELECT 'User'               AS table_name, count(*) FROM "User"
UNION ALL
SELECT 'CompanyMembership'  AS table_name, count(*) FROM "CompanyMembership"
ORDER BY table_name;

-- Expect exactly 1 row: ('cktokenproductions0001', 'Token Productions', ...)
SELECT * FROM "Company";

-- CompanyMembership rows by role (sanity check on OWNER/EDITOR mix)
SELECT role, count(*) FROM "CompanyMembership" GROUP BY role ORDER BY role;

-- Bonus health check: every User should have at least one membership —
-- a User with none has structurally no access to any tenant data once
-- the enforcement layer is wired in. Expect 0 rows back.
SELECT u.id, u.email
FROM "User" u
LEFT JOIN "CompanyMembership" cm ON cm."userId" = u.id
WHERE cm.id IS NULL;

-- ============================================================
-- 4. Composite foreign key integrity — every child row's companyId must
--    equal its parent's companyId. The DB-level composite FK constraints
--    (added in the schema migration) should make a mismatch physically
--    impossible going forward, so every query below is a belt-and-
--    suspenders check — expect every count to be 0. A non-zero count
--    here would mean either a constraint wasn't actually applied, or a
--    row was written before the constraint existed.
-- ============================================================

-- FinanceSource -> Project
SELECT count(*) AS mismatched_financesource_project
FROM "FinanceSource" fs
JOIN "Project" p ON p.id = fs."projectId"
WHERE fs."companyId" IS DISTINCT FROM p."companyId";

-- GalleryItem -> Project
SELECT count(*) AS mismatched_galleryitem_project
FROM "GalleryItem" g
JOIN "Project" p ON p.id = g."projectId"
WHERE g."companyId" IS DISTINCT FROM p."companyId";

-- ReferenceLink -> Project
SELECT count(*) AS mismatched_referencelink_project
FROM "ReferenceLink" r
JOIN "Project" p ON p.id = r."projectId"
WHERE r."companyId" IS DISTINCT FROM p."companyId";

-- SlateProject -> Slate AND -> Project (the mechanism that makes "a
-- slate including another company's film" impossible — both must match)
SELECT count(*) AS mismatched_slateproject_slate
FROM "SlateProject" sp
JOIN "Slate" s ON s.id = sp."slateId"
WHERE sp."companyId" IS DISTINCT FROM s."companyId";

SELECT count(*) AS mismatched_slateproject_project
FROM "SlateProject" sp
JOIN "Project" p ON p.id = sp."projectId"
WHERE sp."companyId" IS DISTINCT FROM p."companyId";

-- Document -> Project (only where projectId is set — a slate-level
-- document has projectId NULL by design, see the XOR CHECK constraint)
SELECT count(*) AS mismatched_document_project
FROM "Document" d
JOIN "Project" p ON p.id = d."projectId"
WHERE d."projectId" IS NOT NULL
  AND d."companyId" IS DISTINCT FROM p."companyId";

-- Document -> Slate (only where slateId is set)
SELECT count(*) AS mismatched_document_slate
FROM "Document" d
JOIN "Slate" s ON s.id = d."slateId"
WHERE d."slateId" IS NOT NULL
  AND d."companyId" IS DISTINCT FROM s."companyId";

-- DocumentDownload -> Project (only where projectId is set)
SELECT count(*) AS mismatched_documentdownload_project
FROM "DocumentDownload" dd
JOIN "Project" p ON p.id = dd."projectId"
WHERE dd."projectId" IS NOT NULL
  AND dd."companyId" IS DISTINCT FROM p."companyId";

-- DocumentDownload -> Slate (only where slateId is set)
SELECT count(*) AS mismatched_documentdownload_slate
FROM "DocumentDownload" dd
JOIN "Slate" s ON s.id = dd."slateId"
WHERE dd."slateId" IS NOT NULL
  AND dd."companyId" IS DISTINCT FROM s."companyId";

-- DocumentDownload -> Document
SELECT count(*) AS mismatched_documentdownload_document
FROM "DocumentDownload" dd
JOIN "Document" doc ON doc.id = dd."documentId"
WHERE dd."companyId" IS DISTINCT FROM doc."companyId";

-- ============================================================
-- 5. Orphan check — a child row whose parent id doesn't exist at all.
--    The composite FK already makes this impossible (the referenced
--    (id, companyId) pair must exist), but checking the plain scalar id
--    independently of companyId catches a dangling reference the
--    composite FK's own matching might have masked. Expect every count
--    to be 0.
-- ============================================================
SELECT 'FinanceSource->Project' AS relation, count(*) FROM "FinanceSource" fs
  LEFT JOIN "Project" p ON p.id = fs."projectId" WHERE p.id IS NULL
UNION ALL
SELECT 'GalleryItem->Project', count(*) FROM "GalleryItem" g
  LEFT JOIN "Project" p ON p.id = g."projectId" WHERE p.id IS NULL
UNION ALL
SELECT 'ReferenceLink->Project', count(*) FROM "ReferenceLink" r
  LEFT JOIN "Project" p ON p.id = r."projectId" WHERE p.id IS NULL
UNION ALL
SELECT 'SlateProject->Slate', count(*) FROM "SlateProject" sp
  LEFT JOIN "Slate" s ON s.id = sp."slateId" WHERE s.id IS NULL
UNION ALL
SELECT 'SlateProject->Project', count(*) FROM "SlateProject" sp
  LEFT JOIN "Project" p ON p.id = sp."projectId" WHERE p.id IS NULL
UNION ALL
SELECT 'Document->Project', count(*) FROM "Document" d
  LEFT JOIN "Project" p ON p.id = d."projectId" WHERE d."projectId" IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'Document->Slate', count(*) FROM "Document" d
  LEFT JOIN "Slate" s ON s.id = d."slateId" WHERE d."slateId" IS NOT NULL AND s.id IS NULL
UNION ALL
SELECT 'DocumentDownload->Project', count(*) FROM "DocumentDownload" dd
  LEFT JOIN "Project" p ON p.id = dd."projectId" WHERE dd."projectId" IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'DocumentDownload->Slate', count(*) FROM "DocumentDownload" dd
  LEFT JOIN "Slate" s ON s.id = dd."slateId" WHERE dd."slateId" IS NOT NULL AND s.id IS NULL
UNION ALL
SELECT 'DocumentDownload->Document', count(*) FROM "DocumentDownload" dd
  LEFT JOIN "Document" doc ON doc.id = dd."documentId" WHERE doc.id IS NULL
ORDER BY relation;
