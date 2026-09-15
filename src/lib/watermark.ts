import "server-only";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

/**
 * Stamp every page of a PDF with a repeating diagonal watermark identifying
 * the recipient's email, the project, and the time of download — so any
 * leaked copy can be traced back to who downloaded it.
 */
export async function watermarkPdf(
  originalBytes: Buffer,
  options: {
    email: string;
    projectTitle: string;
    downloadedAt?: Date;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
  });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timestamp = (options.downloadedAt ?? new Date()).toISOString();
  const label = `${options.projectTitle} — CONFIDENTIAL — Prepared for ${options.email} — ${timestamp}`;

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.max(9, Math.min(14, width / 55));
    const textWidth = font.widthOfTextAtSize(label, fontSize);

    // Tile the watermark diagonally across the page so it can't be cropped out.
    const stepX = textWidth + 90;
    const stepY = 130;
    const diagonal = Math.sqrt(width * width + height * height);

    for (let y = -diagonal; y < diagonal; y += stepY) {
      for (let x = -diagonal; x < diagonal; x += stepX) {
        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.55, 0.55, 0.55),
          opacity: 0.22,
          rotate: degrees(38),
        });
      }
    }

    // A clean footer stamp too, for when the page is printed and the tile
    // pattern falls mostly off-page.
    page.drawText(label, {
      x: 24,
      y: 16,
      size: Math.max(7, fontSize - 3),
      font,
      color: rgb(0.35, 0.35, 0.35),
      opacity: 0.85,
    });
  }

  return pdfDoc.save();
}
