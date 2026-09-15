import "server-only";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return null;
}

export async function recordDownload(params: {
  projectId: string;
  documentId: string;
  email: string;
  request: NextRequest;
}) {
  await prisma.documentDownload.create({
    data: {
      projectId: params.projectId,
      documentId: params.documentId,
      email: params.email,
      ip: clientIp(params.request),
      userAgent: params.request.headers.get("user-agent"),
    },
  });
}
