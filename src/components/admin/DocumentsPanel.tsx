"use client";

import { useRef, useState } from "react";
import { inputClass, Field } from "@/components/admin/FormField";
import type { AdminDocument, AdminProject } from "@/components/admin/types";
import type { SectionDef } from "@/lib/sections";

export default function DocumentsPanel({
  project,
  section,
  onUpdate,
}: {
  project: AdminProject;
  section: SectionDef;
  onUpdate: (patch: Partial<AdminProject>) => void;
}) {
  const docs = project.documents
    .filter((d) => d.section === section.key)
    .sort((a, b) => a.order - b.order);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("section", section.key);
      body.append("title", title);
      const res = await fetch(
        `/api/admin/projects/${project.id}/documents`,
        { method: "POST", body }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      onUpdate({ documents: [...project.documents, data.document] });
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: AdminDocument) {
    if (!confirm(`Delete "${doc.title}"? This can't be undone.`)) return;
    const res = await fetch(
      `/api/admin/projects/${project.id}/documents/${doc.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdate({
        documents: project.documents.filter((d) => d.id !== doc.id),
      });
    }
  }

  async function handleRename(doc: AdminDocument, newTitle: string) {
    const res = await fetch(
      `/api/admin/projects/${project.id}/documents/${doc.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      onUpdate({
        documents: project.documents.map((d) =>
          d.id === doc.id ? data.document : d
        ),
      });
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h2 className="font-display text-2xl">{section.label}</h2>
        <p className="mt-1 text-sm text-muted">{section.description}</p>
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
        <button
          type="submit"
          disabled={!file || uploading}
          className="self-start rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {uploading ? "Uploading…" : "Upload"}
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
