// Copies the pdf.js worker bundle into /public so the flick-through PDF
// viewer can load it same-origin, without depending on a CDN at runtime.
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const src = path.join(
  root,
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
);
const destDir = path.join(root, "public");
const dest = path.join(destDir, "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn(
    "[copy-pdf-worker] pdfjs-dist worker not found (yet) — skipping. This is expected on the very first install pass."
  );
  process.exit(0);
}

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
console.log("[copy-pdf-worker] copied pdf.worker.min.mjs to /public");
