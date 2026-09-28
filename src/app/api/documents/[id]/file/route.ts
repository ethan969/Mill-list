import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessDocument } from "@/lib/access";
import {
  getObjectWebStream,
  getPresignedDownloadUrl,
  isCloudStorageConfigured,
} from "@/lib/storage";

// Streams the original document inline for the flick-through viewer.
// Requires a valid room session for the document's own project, or a
// valid slate session (either for a slate-level document, or reaching a
// project's document via slate membership) — see @/lib/access.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, fileKey: true, mimeType: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const allowed = await canAccessDocument(request, document.id);
  if (!allowed) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  if (isCloudStorageConfigured) {
    // Redirect straight to storage instead of proxying the file through
    // this server — lets the browser make Range requests directly against
    // it for progressive, page-by-page loading, and avoids transferring
    // large files twice (storage -> server -> browser) on every open.
    const url = await getPresignedDownloadUrl(document.fileKey);
    return NextResponse.redirect(url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const stream = await getObjectWebStream(document.fileKey);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
