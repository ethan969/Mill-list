"use client";

import { useRef, useState } from "react";
import { inputClass, Field } from "@/components/admin/FormField";
import type { AdminDocument, AdminSlate } from "@/components/admin/types";
import type { SectionDef } from "@/lib/sections";
import { uploadViaPresign } from "@/lib/client-upload";

export default function SlateDocumentsPanel({
  slate,
  section,
  onUpdate,
}: {
  slate: AdminSlate;
  section: SectionDef;
  onUpdate: (patch: Partial<AdminSlate>) => void;
}) {
  const docs = slate.documents
    .filter((d) => d.section === section.key)
    .sort((a, b) => a.order - b.order);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const result = await uploadViaPresign<{ document: AdminDocument }>({
        file,
        presignPath: `/api/admin/slates/${slate.id}/documents/presign`,
        confirmPath: `/api/admin/slates/${slate.id}/documents/confirm`,
        presignExtra: { section: section.key },
        confirmExtra: { section: section.key, title },
        onProgress: setProgress,
      });

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      if (result.status === "not_configured") {
        const body = new FormData();
        body.append("file", file);
        body.append("section", section.key);
        body.append("title", title);
        const res = await fetch(`/api/admin/slates/${slate.id}/documents`, {
          method: "POST",
          body,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Upload failed.");
          return;
        }
        onUpdate({ documents: [...slate.documents, data.document] });
      } else {
        onUpdate({ documents: [...slate.documents, result.data.document] });
      }

      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDelete(doc: AdminDocument) {
    if (!confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/slates/${slate.id}/documents/${doc.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onUpdate({
        documents: slate.documents.filter((d) => d.id !== doc.id),
      });
    }
  }

  async function handleRename(doc: AdminDocument, newTitle: string) {
    const res = await fetch(`/api/admin/slates/${slate.id}/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate({
        documents: slate.documents.map((d) =>
          d.id === doc.id ? data.document : d
        ),
      });
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h2 className="font-display text-2xl">{section.label}</h2>
        <p className="mt-1 text-sm text-muted">
          {section.description} Shared with every film in this slate.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Upload PDF
        </p>
        <Field label="Display title" hint="Defaults to the file name">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={section.label}
          />
        </Field>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs text-muted"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {uploading && progress > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={!file || uploading}
          className="self-start rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {uploading
            ? progress > 0
              ? `Uploading… ${Math.round(progress * 100)}%`
              : "Preparing…"
            : "Upload"}
        </button>
      </form>

      {docs.length > 0 && (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <input
                defaultValue={doc.title}
                onBlur={(e) => {
                  if (e.target.value !== doc.title) {
                    handleRename(doc, e.target.value);
                  }
                }}
                className="flex-1 bg-transparent text-sm outline-none focus:underline"
              />
              <span className="text-xs text-muted">{doc.fileName}</span>
              <button
                onClick={() => handleDelete(doc)}
                className="text-xs text-danger hover:opacity-70 transition-opacity"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
