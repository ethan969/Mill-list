-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastUsedStep" INTEGER,
ADD COLUMN     "totpSecretEncrypted" TEXT;

-- CreateTable
CREATE TABLE "AdminRecoveryCode" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminRecoveryCode_adminId_idx" ON "AdminRecoveryCode"("adminId");

-- AddForeignKey
ALTER TABLE "AdminRecoveryCode" ADD CONSTRAINT "AdminRecoveryCode_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
