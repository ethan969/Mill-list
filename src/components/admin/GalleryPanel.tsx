"use client";

import { useRef, useState } from "react";
import { inputClass } from "@/components/admin/FormField";
import type { AdminGalleryItem, AdminProject } from "@/components/admin/types";
import { uploadViaPresign } from "@/lib/client-upload";

export default function GalleryPanel({
  project,
  onUpdate,
}: {
  project: AdminProject;
  onUpdate: (patch: Partial<AdminProject>) => void;
}) {
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [refLabel, setRefLabel] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [refError, setRefError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const result = await uploadViaPresign<{ item: AdminGalleryItem }>({
        file,
        presignPath: `/api/admin/projects/${project.id}/gallery/presign`,
        confirmPath: `/api/admin/projects/${project.id}/gallery/confirm`,
        confirmExtra: { caption },
        onProgress: setProgress,
      });

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      if (result.status === "not_configured") {
        // No cloud storage configured (local dev) — fall back to the
        // classic proxied upload, which has no size-limit concerns there.
        const body = new FormData();
        body.append("file", file);
        if (caption) body.append("caption", caption);
        const res = await fetch(`/api/admin/projects/${project.id}/gallery`, {
          method: "POST",
          body,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Upload failed.");
          return;
        }
        onUpdate({ gallery: [...project.gallery, data.item] });
      } else {
        onUpdate({ gallery: [...project.gallery, result.data.item] });
      }

      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDeleteItem(id: string) {
    const res = await fetch(
      `/api/admin/projects/${project.id}/gallery/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdate({ gallery: project.gallery.filter((g) => g.id !== id) });
    }
  }

  async function handleAddReference(e: React.FormEvent) {
    e.preventDefault();
    setRefError(null);
    try {
      const res = await fetch(
        `/api/admin/projects/${project.id}/references`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: refLabel, url: refUrl }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefError(data.error || "Couldn't add link.");
        return;
      }
      onUpdate({ references: [...project.references, data.reference] });
      setRefLabel("");
      setRefUrl("");
    } catch {
      setRefError("Network error.");
    }
  }

  async function handleDeleteReference(id: string) {
    const res = await fetch(
      `/api/admin/projects/${project.id}/references/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdate({ references: project.references.filter((r) => r.id !== id) });
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <div>
        <h2 className="font-display text-2xl">Gallery</h2>
        <p className="mt-1 text-sm text-muted">
          Stills, concept art, sizzle reels or behind-the-scenes footage.
        </p>

        <form
          onSubmit={handleUpload}
          className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-5"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            className="text-xs text-muted"
          />
          <input
            placeholder="Caption (optional)"
            className={inputClass}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
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
            disabled={uploading}
            className="self-start rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {uploading
              ? progress > 0
                ? `Uploading… ${Math.round(progress * 100)}%`
                : "Preparing…"
              : "Upload"}
          </button>
        </form>

        {project.gallery.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {project.gallery.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-md border border-border bg-surface"
              >
                {item.type === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/gallery/${item.id}/file`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                    Video
                  </div>
                )}
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-[10px] uppercase tracking-wide text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-2xl">References</h2>
        <p className="mt-1 text-sm text-muted">
          Links to comps, lookbooks, articles or other external material.
        </p>

        <form
          onSubmit={handleAddReference}
          className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <input
              placeholder="Label"
              className={`${inputClass} w-full`}
              value={refLabel}
              onChange={(e) => setRefLabel(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <input
              placeholder="https://…"
              type="url"
              className={`${inputClass} w-full`}
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2.5 text-xs hover:border-accent hover:text-accent transition-colors"
          >
            Add
          </button>
        </form>
        {refError && <p className="mt-2 text-xs text-danger">{refError}</p>}

        {project.references.length > 0 && (
          <div className="mt-4 flex flex-col divide-y divide-border rounded-lg border border-border">
            {project.references.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{ref.label}</p>
                  <p className="truncate text-xs text-muted">{ref.url}</p>
                </div>
                <button
                  onClick={() => handleDeleteReference(ref.id)}
                  className="shrink-0 text-xs text-danger hover:opacity-70 transition-opacity"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
