-- AlterTable
ALTER TABLE "DocumentDownload" ADD COLUMN     "emailSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkOpened" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "logoMimeType" TEXT,
ADD COLUMN     "themeId" TEXT NOT NULL DEFAULT 'midnight-gold',
ALTER COLUMN "accentColor" DROP NOT NULL,
ALTER COLUMN "accentColor" DROP DEFAULT;
