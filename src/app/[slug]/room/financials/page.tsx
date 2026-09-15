import { getSectionDocuments } from "@/lib/get-section-documents";
import DocumentSectionView from "@/components/DocumentSectionView";
import EmptyState from "@/components/EmptyState";

export default async function FinancialsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const documents = await getSectionDocuments(slug, "FINANCIALS");

  if (documents.length === 0) return <EmptyState label="Financials" />;
  return <DocumentSectionView documents={documents} />;
}
