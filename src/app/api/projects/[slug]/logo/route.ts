import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getObjectWebStream } from "@/lib/storage";

// Public, unauthenticated: the logo is branding shown before the password
// gate (landing page) and in the room header, not a confidential document.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { logoKey: true, logoMimeType: true },
  });

  if (!project || !project.logoKey) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const stream = await getObjectWebStream(project.logoKey);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": project.logoMimeType || "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
