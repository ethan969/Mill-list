-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileName" TEXT NOT NULL DEFAULT 'document.pdf',
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'application/pdf';

-- AlterTable
ALTER TABLE "GalleryItem" ADD COLUMN     "fileName" TEXT NOT NULL DEFAULT 'file',
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream';
