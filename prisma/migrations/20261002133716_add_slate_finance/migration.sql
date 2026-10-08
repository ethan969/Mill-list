-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('GBP', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "FinanceSourceType" AS ENUM ('EQUITY', 'BFI', 'TAX_CREDIT', 'PRESALE', 'GAP', 'DEBT', 'SOFT_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceSourceStatus" AS ENUM ('COMMITTED', 'IN_NEGOTIATION', 'SOUGHT');

-- CreateEnum
CREATE TYPE "RecoupmentStructure" AS ENUM ('RING_FENCED', 'CROSS_COLLATERALISED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "currency" "Currency",
ADD COLUMN     "equitySought" BIGINT,
ADD COLUMN     "financeUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "grossBudget" BIGINT,
ADD COLUMN     "minimumTicket" BIGINT;

-- AlterTable
ALTER TABLE "Slate" ADD COLUMN     "disclaimerText" TEXT,
ADD COLUMN     "financeDisplayCurrency" "Currency" NOT NULL DEFAULT 'GBP',
ADD COLUMN     "recoupmentNote" TEXT,
ADD COLUMN     "recoupmentStructure" "RecoupmentStructure";

-- CreateTable
CREATE TABLE "FinanceSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceSourceType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "FinanceSourceStatus" NOT NULL,
    "recoups" BOOLEAN NOT NULL DEFAULT true,
    "recoupmentPosition" INTEGER,
    "recoupmentPremiumBps" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "from" "Currency" NOT NULL,
    "to" "Currency" NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceSource_projectId_idx" ON "FinanceSource"("projectId");

-- CreateIndex
CREATE INDEX "FxRate_from_to_asOfDate_idx" ON "FxRate"("from", "to", "asOfDate");

-- AddForeignKey
ALTER TABLE "FinanceSource" ADD CONSTRAINT "FinanceSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
