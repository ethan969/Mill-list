import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyDownloadToken } from "@/lib/auth";
import { getObjectBuffer } from "@/lib/storage";
import { watermarkPdf } from "@/lib/watermark";

// Public, token-authenticated: this is the link emailed to whoever requested
// a watermarked copy. It may be opened on a different device than the one
// that made the request, so it carries its own credential (the signed
// token) rather than relying on the room session cookie.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const payload = await verifyDownloadToken(token);
  if (!payload || payload.documentId !== id) {
    return NextResponse.json(
      { error: "This link is invalid or has expired." },
      { status: 403 }
    );
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      fileKey: true,
      mimeType: true,
      project: { select: { title: true } },
    },
  });
  if (!document || document.mimeType !== "application/pdf") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const original = await getObjectBuffer(document.fileKey);
  const watermarked = await watermarkPdf(original, {
    email: payload.email,
    projectTitle: document.project.title,
  });

  await prisma.documentDownload
    .update({
      where: { id: payload.downloadId },
      data: { linkOpened: true },
    })
    .catch(() => {
      // The download record may have been deleted (e.g. project removed);
      // the link itself is still valid on its own signed claims.
    });

  const safeTitle =
    document.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "document";

  return new NextResponse(Buffer.from(watermarked), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle} (watermarked).pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
