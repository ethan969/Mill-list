import { redirect } from "next/navigation";
import { getSectionDocuments } from "@/lib/get-section-documents";
import { getRoomAvailability, firstAvailableSection } from "@/lib/room-availability";
import { requireRoomAccess } from "@/lib/require-room-access";
import DocumentSectionView from "@/components/DocumentSectionView";
import EmptyState from "@/components/EmptyState";

export default async function ProductionPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireRoomAccess(slug);
  const { projectId, documents } = await getSectionDocuments(slug, "PRODUCTION_PLAN");

  if (documents.length === 0) {
    const fallback = firstAvailableSection(await getRoomAvailability(projectId));
    if (fallback) redirect(`/${slug}/room/${fallback}`);
    return <EmptyState label="The production plan" />;
  }
  return <DocumentSectionView documents={documents} />;
}
