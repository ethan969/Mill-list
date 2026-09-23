import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getObjectWebStream, headObject } from "@/lib/storage";
import {
  isPosterWidth,
  isPosterFormat,
  posterVariantKey,
} from "@/lib/poster-variants";

// Public, unauthenticated: the poster is landing-page art shown before the
// password gate, not a confidential document.
//
// With no query params, behaves exactly as before: streams the original
// upload. The responsive <picture> on the landing page additionally
// requests `?w=<width>&fmt=<avif|webp>` for a pre-generated variant; if
// one isn't there (e.g. a poster uploaded before variants existed), this
// falls back to the original rather than 404ing.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, posterKey: true, posterMimeType: true },
  });

  if (!project || !project.posterKey) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const w = Number(request.nextUrl.searchParams.get("w"));
  const fmt = request.nextUrl.searchParams.get("fmt") ?? "";

  if (isPosterWidth(w) && isPosterFormat(fmt)) {
    const variantKey = posterVariantKey(project.id, w, fmt);
    if (await headObject(variantKey)) {
      const stream = await getObjectWebStream(variantKey);
      return new NextResponse(stream, {
        headers: {
          "Content-Type": `image/${fmt}`,
          // Variant keys are stable per (project, width, format) and are
          // overwritten in place on re-upload, so a long, immutable cache
          // would go stale on a poster change — keep it aligned with the
          // original's cache lifetime instead.
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  const stream = await getObjectWebStream(project.posterKey);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": project.posterMimeType || "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
