import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRoomAccessForProject } from "@/lib/auth";
import { getObjectWebStream } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const item = await prisma.galleryItem.findUnique({
    where: { id },
    select: {
      fileKey: true,
      mimeType: true,
      project: { select: { id: true, slug: true } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const allowed = await verifyRoomAccessForProject(
    item.project.slug,
    item.project.id
  );
  if (!allowed) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const stream = await getObjectWebStream(item.fileKey);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": item.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
