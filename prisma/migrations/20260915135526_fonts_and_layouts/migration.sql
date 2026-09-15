-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "fontId" TEXT,
ADD COLUMN     "landingLayout" TEXT NOT NULL DEFAULT 'centered',
ADD COLUMN     "roomLayout" TEXT NOT NULL DEFAULT 'top-nav';
