import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRoomAccessForProject } from "@/lib/auth";
import { getObjectWebStream } from "@/lib/storage";

// Streams the original document inline for the flick-through viewer.
// Requires a valid room session for the document's own project.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      fileKey: true,
      mimeType: true,
      project: { select: { id: true, slug: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const allowed = await verifyRoomAccessForProject(
    document.project.slug,
    document.project.id
  );
  if (!allowed) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
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
