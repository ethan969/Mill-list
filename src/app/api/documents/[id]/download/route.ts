import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRoomAccessForProject } from "@/lib/auth";
import { getObjectBuffer } from "@/lib/storage";
import { watermarkPdf } from "@/lib/watermark";
import { recordDownload, clientIp } from "@/lib/leads";
import { emailSchema } from "@/lib/validation";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      fileKey: true,
      mimeType: true,
      project: { select: { id: true, slug: true, title: true } },
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

  const ip = clientIp(request) ?? "unknown";
  const rateKey = `download:${document.id}:${ip}`;
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = emailSchema.safeParse(body.email);
  if (!parsed.success) {
    recordAttempt(rateKey);
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  const email = parsed.data;

  if (document.mimeType !== "application/pdf") {
    return NextResponse.json(
      { error: "This file type can't be watermarked for download." },
      { status: 400 }
    );
  }

  const original = await getObjectBuffer(document.fileKey);
  const watermarked = await watermarkPdf(original, {
    email,
    projectTitle: document.project.title,
  });

  await recordDownload({
    projectId: document.project.id,
    documentId: document.id,
    email,
    request,
  });

  const safeTitle = document.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "document";

  return new NextResponse(Buffer.from(watermarked), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle} (watermarked).pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
