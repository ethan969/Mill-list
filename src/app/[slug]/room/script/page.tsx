import { redirect } from "next/navigation";
import { getSectionDocuments } from "@/lib/get-section-documents";
import { getRoomAvailability, firstAvailableSection } from "@/lib/room-availability";
import DocumentSectionView from "@/components/DocumentSectionView";
import EmptyState from "@/components/EmptyState";

export default async function ScriptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { projectId, documents } = await getSectionDocuments(slug, "SCRIPT");

  if (documents.length === 0) {
    const fallback = firstAvailableSection(await getRoomAvailability(projectId));
    if (fallback) redirect(`/${slug}/room/${fallback}`);
    return <EmptyState label="The script" />;
  }
  return <DocumentSectionView documents={documents} />;
}
