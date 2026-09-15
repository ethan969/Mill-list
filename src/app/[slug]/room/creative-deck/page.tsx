import { getSectionDocuments } from "@/lib/get-section-documents";
import DocumentSectionView from "@/components/DocumentSectionView";
import EmptyState from "@/components/EmptyState";

export default async function CreativeDeckPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const documents = await getSectionDocuments(slug, "CREATIVE_DECK");

  if (documents.length === 0) return <EmptyState label="The creative deck" />;
  return <DocumentSectionView documents={documents} />;
}
