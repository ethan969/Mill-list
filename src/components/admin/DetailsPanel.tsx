"use client";

import { useState } from "react";
import { inputClass, Field, slugify } from "@/components/admin/FormField";
import type { AdminProject } from "@/components/admin/types";

export default function DetailsPanel({
  project,
  onUpdate,
}: {
  project: AdminProject;
  onUpdate: (patch: Partial<AdminProject>) => void;
}) {
  const [form, setForm] = useState({
    title: project.title,
    slug: project.slug,
    productionCompany: project.productionCompany,
    tagline: project.tagline ?? "",
    logline: project.logline ?? "",
    accentColor: project.accentColor,
  });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterVersion, setPosterVersion] = useState(0);

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save changes.");
        return;
      }
      onUpdate(data.project);
      setMessage("Saved.");
      setNewPassword("");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePosterUpload(file: File) {
    setPosterUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/admin/projects/${project.id}/poster`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't upload poster.");
        return;
      }
      onUpdate(data.project);
      setPosterVersion((v) => v + 1);
    } catch {
      setError("Network error.");
    } finally {
      setPosterUploading(false);
    }
  }

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${form.slug}`
      : `/${form.slug}`;

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
            Details
          </h2>
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <Field label="Film title">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>

        <Field label="Production company">
          <input
            className={inputClass}
            value={form.productionCompany}
            onChange={(e) =>
              setForm((f) => ({ ...f, productionCompany: e.target.value }))
            }
          />
        </Field>

        <Field label="URL slug" hint={publicUrl}>
          <input
            className={`${inputClass} font-mono`}
            value={form.slug}
            onChange={(e) =>
              setForm((f) => ({ ...f, slug: slugify(e.target.value) }))
            }
          />
        </Field>

        <Field label="Tagline">
          <input
            className={inputClass}
            value={form.tagline}
            onChange={(e) =>
              setForm((f) => ({ ...f, tagline: e.target.value }))
            }
          />
        </Field>

        <Field label="Logline" hint="Internal reference, not shown publicly">
          <textarea
            className={`${inputClass} min-h-20`}
            value={form.logline}
            onChange={(e) =>
              setForm((f) => ({ ...f, logline: e.target.value }))
            }
          />
        </Field>

        <Field label="Accent color">
          <input
            type="color"
            className="h-10 w-16 rounded border border-border bg-surface"
            value={form.accentColor}
            onChange={(e) =>
              setForm((f) => ({ ...f, accentColor: e.target.value }))
            }
          />
        </Field>

        {error && <p className="text-xs text-danger">{error}</p>}
        {message && <p className="text-xs text-accent">{message}</p>}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Publish
        </h2>
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm">
              {project.isPublished ? "Live" : "Draft"}
            </p>
            <p className="text-xs text-muted">
              {project.isPublished
                ? "Anyone with the link and password can access the room."
                : "The room is hidden until you publish it."}
            </p>
          </div>
          <button
            onClick={() => save({ isPublished: !project.isPublished })}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent transition-colors"
          >
            {project.isPublished ? "Unpublish" : "Publish"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Data room password
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New password"
            className={`${inputClass} flex-1 font-mono`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            onClick={() => save({ password: newPassword })}
            disabled={newPassword.length < 4 || saving}
            className="rounded-md border border-border px-4 py-2 text-xs hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
          >
            Update
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Landing page poster
        </h2>
        {project.posterKey && (
          <div className="h-32 w-56 overflow-hidden rounded-md border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/projects/${project.slug}/poster?v=${posterVersion}`}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePosterUpload(file);
          }}
          disabled={posterUploading}
          className="text-xs text-muted"
        />
      </section>
    </div>
  );
}
