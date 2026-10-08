-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'EDITOR');

-- RenameTable: AdminUser -> User (hand-written rename, not drop+recreate,
-- so every existing row keeps its id — existing admin_session JWTs, whose
-- `sub` claim is that id, and existing 2FA enrollment keep working
-- unchanged across this migration).
ALTER TABLE "AdminUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "AdminUser_pkey" TO "User_pkey";
ALTER INDEX "AdminUser_email_key" RENAME TO "User_email_key";
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- RenameColumn: AdminRecoveryCode.adminId -> userId (hand-written rename,
-- not drop+recreate, so every existing recovery code keeps its linkage).
ALTER TABLE "AdminRecoveryCode" DROP CONSTRAINT "AdminRecoveryCode_adminId_fkey";
ALTER TABLE "AdminRecoveryCode" RENAME COLUMN "adminId" TO "userId";
ALTER INDEX "AdminRecoveryCode_adminId_idx" RENAME TO "AdminRecoveryCode_userId_idx";
ALTER TABLE "AdminRecoveryCode" ADD CONSTRAINT "AdminRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey (single-column FKs being replaced by composite
-- (parentId, companyId) FKs further below)
ALTER TABLE "Document" DROP CONSTRAINT "Document_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_slateId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentDownload" DROP CONSTRAINT "DocumentDownload_documentId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentDownload" DROP CONSTRAINT "DocumentDownload_projectId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentDownload" DROP CONSTRAINT "DocumentDownload_slateId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceSource" DROP CONSTRAINT "FinanceSource_projectId_fkey";

-- DropForeignKey
ALTER TABLE "GalleryItem" DROP CONSTRAINT "GalleryItem_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ReferenceLink" DROP CONSTRAINT "ReferenceLink_projectId_fkey";

-- DropForeignKey
ALTER TABLE "SlateProject" DROP CONSTRAINT "SlateProject_projectId_fkey";

-- DropForeignKey
ALTER TABLE "SlateProject" DROP CONSTRAINT "SlateProject_slateId_fkey";

-- DropIndex
DROP INDEX "FxRate_from_to_asOfDate_idx";

-- AlterTable: nullable companyId for now — backfilled by the next
-- migration's data-only step, flipped NOT NULL by a later migration once
-- every admin route is on the tenant-scoped client.
ALTER TABLE "Document" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "DocumentDownload" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "FinanceSource" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "FxRate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "GalleryItem" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "ReferenceLink" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Slate" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "SlateProject" ADD COLUMN     "companyId" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "CompanyMembership_companyId_idx" ON "CompanyMembership"("companyId");

-- CreateIndex
CREATE INDEX "CompanyMembership_userId_idx" ON "CompanyMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_userId_companyId_key" ON "CompanyMembership"("userId", "companyId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Document_companyId_idx" ON "Document"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_companyId_key" ON "Document"("id", "companyId");

-- CreateIndex
CREATE INDEX "DocumentDownload_companyId_idx" ON "DocumentDownload"("companyId");

-- CreateIndex
CREATE INDEX "FinanceSource_companyId_idx" ON "FinanceSource"("companyId");

-- CreateIndex
CREATE INDEX "FxRate_companyId_from_to_asOfDate_idx" ON "FxRate"("companyId", "from", "to", "asOfDate");

-- CreateIndex
CREATE INDEX "GalleryItem_companyId_idx" ON "GalleryItem"("companyId");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_companyId_key" ON "Project"("id", "companyId");

-- CreateIndex
CREATE INDEX "ReferenceLink_companyId_idx" ON "ReferenceLink"("companyId");

-- CreateIndex
CREATE INDEX "Slate_companyId_idx" ON "Slate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_id_companyId_key" ON "Slate"("id", "companyId");

-- CreateIndex
CREATE INDEX "SlateProject_companyId_idx" ON "SlateProject"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSource" ADD CONSTRAINT "FinanceSource_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProject" ADD CONSTRAINT "SlateProject_slateId_companyId_fkey" FOREIGN KEY ("slateId", "companyId") REFERENCES "Slate"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProject" ADD CONSTRAINT "SlateProject_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_slateId_companyId_fkey" FOREIGN KEY ("slateId", "companyId") REFERENCES "Slate"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceLink" ADD CONSTRAINT "ReferenceLink_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDownload" ADD CONSTRAINT "DocumentDownload_projectId_companyId_fkey" FOREIGN KEY ("projectId", "companyId") REFERENCES "Project"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDownload" ADD CONSTRAINT "DocumentDownload_slateId_companyId_fkey" FOREIGN KEY ("slateId", "companyId") REFERENCES "Slate"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDownload" ADD CONSTRAINT "DocumentDownload_documentId_companyId_fkey" FOREIGN KEY ("documentId", "companyId") REFERENCES "Document"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
