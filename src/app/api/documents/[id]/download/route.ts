import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createDownloadToken } from "@/lib/auth";
import { resolveDocumentAccess } from "@/lib/access";
import { recordDownload, clientIp } from "@/lib/leads";
import { sendDownloadLinkEmail } from "@/lib/email";
import { emailSchema } from "@/lib/validation";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit";
import { getTheme } from "@/lib/themes";

const APP_URL = process.env.APP_URL;

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
      mimeType: true,
      project: {
        select: {
          id: true,
          title: true,
          productionCompany: true,
          themeId: true,
          accentColor: true,
        },
      },
      slate: {
        select: { id: true, title: true, themeId: true, accentColor: true },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const access = await resolveDocumentAccess(request, document.id);
  if (!access.ok) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  // Exactly one of these is set — enforced at the database level (see the
  // slate-mode migration's CHECK constraint on Document).
  const owner = document.project
    ? {
        title: document.project.title,
        productionCompany: document.project.productionCompany,
        themeId: document.project.themeId,
        accentColor: document.project.accentColor,
      }
    : {
        title: document.slate!.title,
        productionCompany: "Slate",
        themeId: document.slate!.themeId,
        accentColor: document.slate!.accentColor,
      };

  const ip = clientIp(request) ?? "unknown";
  const rateKey = `download:${document.id}:${ip}`;
  const rate = await checkRateLimit(rateKey);
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
    await recordAttempt(rateKey);
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

  const download = await recordDownload({
    projectId: access.projectId,
    slateId: access.slateId,
    documentId: document.id,
    email,
    request,
  });

  const token = await createDownloadToken({
    downloadId: download.id,
    documentId: document.id,
    email,
  });

  const origin = APP_URL || request.nextUrl.origin;
  const downloadUrl = `${origin}/api/documents/${document.id}/download/link?token=${encodeURIComponent(token)}`;

  const theme = getTheme(owner.themeId);
  const accentColor = owner.accentColor || theme.colors.accent;

  try {
    const result = await sendDownloadLinkEmail({
      to: email,
      projectTitle: owner.title,
      productionCompany: owner.productionCompany,
      documentTitle: document.title,
      downloadUrl,
      accentColor,
    });
    if (result.delivered) {
      await prisma.documentDownload.update({
        where: { id: download.id },
        data: { emailSent: true },
      });
    }
  } catch (err) {
    console.error("Failed to send download email:", err);
    return NextResponse.json(
      { error: "Couldn't send the email. Try again shortly." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
