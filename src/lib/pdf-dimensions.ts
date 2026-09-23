import { PDFDocument } from "pdf-lib";

/**
 * Read a PDF's first-page size so the flick-through viewer can reserve the
 * correct aspect ratio before react-pdf has loaded anything — otherwise the
 * viewer pops in at its rendered size and shifts everything below it.
 * Returns null for a corrupt/unreadable PDF rather than blocking the
 * upload on it.
 */
export async function getPdfPageSize(
  bytes: Buffer
): Promise<{ width: number; height: number } | null> {
  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    return { width, height };
  } catch {
    return null;
  }
}
