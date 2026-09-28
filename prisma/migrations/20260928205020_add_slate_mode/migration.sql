-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "slateId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DocumentDownload" ADD COLUMN     "slateId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Slate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "themeId" TEXT NOT NULL DEFAULT 'midnight-gold',
    "accentColor" TEXT,
    "fontId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlateProject" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Slate_slug_key" ON "Slate"("slug");

-- CreateIndex
CREATE INDEX "Slate_slug_idx" ON "Slate"("slug");

-- CreateIndex
CREATE INDEX "SlateProject_slateId_idx" ON "SlateProject"("slateId");

-- CreateIndex
CREATE INDEX "SlateProject_projectId_idx" ON "SlateProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SlateProject_slateId_projectId_key" ON "SlateProject"("slateId", "projectId");

-- CreateIndex
CREATE INDEX "Document_slateId_section_idx" ON "Document"("slateId", "section");

-- CreateIndex
CREATE INDEX "DocumentDownload_slateId_idx" ON "DocumentDownload"("slateId");

-- AddForeignKey
ALTER TABLE "SlateProject" ADD CONSTRAINT "SlateProject_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProject" ADD CONSTRAINT "SlateProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDownload" ADD CONSTRAINT "DocumentDownload_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A document belongs to exactly one of a project's room or a slate — never
-- both, never neither. Prisma's schema DSL has no way to express an
-- arbitrary CHECK constraint, so it's added here directly; not expressible
-- as application-level validation alone without a race between two
-- concurrent writes both passing an app-level check before either commits.
ALTER TABLE "Document" ADD CONSTRAINT "Document_project_or_slate_check"
  CHECK (
    ("projectId" IS NOT NULL AND "slateId" IS NULL) OR
    ("projectId" IS NULL AND "slateId" IS NOT NULL)
  );
