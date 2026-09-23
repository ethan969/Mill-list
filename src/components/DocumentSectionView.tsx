"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import DownloadModal from "@/components/DownloadModal";

// react-pdf touches `window`/`document` at module scope, so it must never be
// evaluated during SSR.
const FlickBook = dynamic(() => import("@/components/FlickBook"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-border bg-surface">
      <p className="text-sm text-muted">Loading viewer…</p>
    </div>
  ),
});

type DocSummary = {
  id: string;
  title: string;
  pageCount: number | null;
  pageWidth: number | null;
  pageHeight: number | null;
};

export default function DocumentSectionView({
  documents,
}: {
  documents: DocSummary[];
}) {
  const [activeId, setActiveId] = useState(documents[0]?.id ?? "");
  const [downloadTarget, setDownloadTarget] = useState<DocSummary | null>(
    null
  );

  const active = documents.find((d) => d.id === activeId) ?? documents[0];
  if (!active) return null;

  return (
    <div className="flex flex-col gap-5">
      {documents.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setActiveId(doc.id)}
              className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                doc.id === active.id
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {doc.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">{active.title}</h2>
        <button
          onClick={() => setDownloadTarget(active)}
          className="rounded-md border border-border px-4 py-2 text-xs uppercase tracking-widest text-muted hover:border-accent hover:text-accent transition-colors"
        >
          Email watermarked copy
        </button>
      </div>

      <FlickBook
        key={active.id}
        fileUrl={`/api/documents/${active.id}/file`}
        pdfWidth={active.pageWidth}
        pdfHeight={active.pageHeight}
      />

      {downloadTarget && (
        <DownloadModal
          documentId={downloadTarget.id}
          documentTitle={downloadTarget.title}
          onClose={() => setDownloadTarget(null)}
        />
      )}
    </div>
  );
}
