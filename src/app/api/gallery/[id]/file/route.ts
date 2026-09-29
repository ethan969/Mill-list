import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canAccessProject } from "@/lib/access";
import { getObjectWebStream } from "@/lib/storage";

// Gallery items don't have a slate-level equivalent (unlike Document) — a
// slate visitor reaching one here does so via member-project access, same
// as a room page.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const item = await prisma.galleryItem.findUnique({
    where: { id },
    select: {
      fileKey: true,
      mimeType: true,
      project: { select: { id: true } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const allowed = await canAccessProject(request, item.project.id);
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
