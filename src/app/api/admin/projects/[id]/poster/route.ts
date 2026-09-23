import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { putObject, deleteObject, buildAssetKey } from "@/lib/storage";
import {
  POSTER_WIDTHS,
  POSTER_FORMATS,
  posterVariantHeight,
  posterVariantKey,
} from "@/lib/poster-variants";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Poster must be a JPEG, PNG or WebP image." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildAssetKey(project.id, "poster", "poster", file.name || "poster.jpg");
  await putObject(key, buffer, file.type);

  if (project.posterKey && project.posterKey !== key) {
    await deleteObject(project.posterKey).catch(() => {});
  }

  // Generate AVIF/WebP variants at each breakpoint for the responsive
  // <picture> on the landing page. Best-effort: a variant failing to
  // generate (e.g. an unusual source format) shouldn't fail the upload —
  // the public poster route falls back to the original for any variant
  // that isn't there.
  await Promise.all(
    POSTER_WIDTHS.flatMap((width) =>
      POSTER_FORMATS.map(async (format) => {
        try {
          const variant = await sharp(buffer)
            .resize(width, posterVariantHeight(width), {
              fit: "cover",
              position: sharp.strategy.attention,
            })
            .toFormat(format, { quality: 70 })
            .toBuffer();
          await putObject(
            posterVariantKey(project.id, width, format),
            variant,
            `image/${format}`
          );
        } catch (err) {
          console.error(`Failed to generate ${format} poster variant at ${width}px:`, err);
        }
      })
    )
  );

  const updated = await prisma.project.update({
    where: { id },
    data: { posterKey: key, posterMimeType: file.type },
  });

  return NextResponse.json({ project: updated });
}
