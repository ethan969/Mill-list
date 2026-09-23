import { PrismaClient } from "@prisma/client";
import { getObjectBuffer } from "../src/lib/storage";
import { getPdfPageSize } from "../src/lib/pdf-dimensions";

const prisma = new PrismaClient();

/**
 * One-off backfill for documents uploaded before pageWidth/pageHeight
 * existed on the Document model — populates them the same way the upload
 * routes do now, so the flick-through viewer can reserve the correct
 * aspect ratio for older documents too instead of only new uploads.
 * Safe to re-run: only touches rows where either field is still null.
 */
async function main() {
  const documents = await prisma.document.findMany({
    where: { OR: [{ pageWidth: null }, { pageHeight: null }] },
    select: { id: true, title: true, fileKey: true },
  });

  if (documents.length === 0) {
    console.log("Nothing to backfill — every document already has its page size.");
    return;
  }

  console.log(`Backfilling page size for ${documents.length} document(s)...`);

  let updated = 0;
  let failed = 0;

  for (const doc of documents) {
    try {
      const buffer = await getObjectBuffer(doc.fileKey);
      const size = await getPdfPageSize(buffer);
      if (!size) {
        console.warn(`  skip: "${doc.title}" (${doc.id}) — couldn't read PDF page size`);
        failed++;
        continue;
      }
      await prisma.document.update({
        where: { id: doc.id },
        data: { pageWidth: size.width, pageHeight: size.height },
      });
      console.log(`  ok: "${doc.title}" (${doc.id}) -> ${size.width}x${size.height}`);
      updated++;
    } catch (err) {
      console.warn(`  skip: "${doc.title}" (${doc.id}) — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`Done. ${updated} updated, ${failed} skipped.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
