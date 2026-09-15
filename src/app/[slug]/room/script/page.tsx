import { getSectionDocuments } from "@/lib/get-section-documents";
import DocumentSectionView from "@/components/DocumentSectionView";
import EmptyState from "@/components/EmptyState";

export default async function ScriptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const documents = await getSectionDocuments(slug, "SCRIPT");

  if (documents.length === 0) return <EmptyState label="The script" />;
  return <DocumentSectionView documents={documents} />;
}
