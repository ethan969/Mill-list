import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getObjectWebStream } from "@/lib/storage";

// Public, unauthenticated: the poster is landing-page art shown before the
// password gate, not a confidential document.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { posterKey: true, posterMimeType: true, isPublished: true },
  });

  if (!project || !project.isPublished || !project.posterKey) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const stream = await getObjectWebStream(project.posterKey);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": project.posterMimeType || "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
