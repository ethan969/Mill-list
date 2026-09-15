import { getSectionDocuments } from "@/lib/get-section-documents";
import DocumentSectionView from "@/components/DocumentSectionView";
import EmptyState from "@/components/EmptyState";

export default async function ProductionPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const documents = await getSectionDocuments(slug, "PRODUCTION_PLAN");

  if (documents.length === 0) return <EmptyState label="The production plan" />;
  return <DocumentSectionView documents={documents} />;
}
