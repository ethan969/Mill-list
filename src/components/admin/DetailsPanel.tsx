"use client";

import { useState } from "react";
import { inputClass, Field, slugify } from "@/components/admin/FormField";
import type { AdminProject } from "@/components/admin/types";
import { THEMES, FONTS, getTheme } from "@/lib/themes";
import { LANDING_LAYOUTS, ROOM_LAYOUTS } from "@/lib/layouts";

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
  });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterVersion, setPosterVersion] = useState(0);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);

  const theme = getTheme(project.themeId);
  const currentAccent = project.accentColor || theme.colors.accent;

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

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/admin/projects/${project.id}/logo`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't upload logo.");
        return;
      }
      onUpdate(data.project);
      setLogoVersion((v) => v + 1);
    } catch {
      setError("Network error.");
    } finally {
      setLogoUploading(false);
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

        {error && <p className="text-xs text-danger">{error}</p>}
        {message && <p className="text-xs text-accent">{message}</p>}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Visual theme
        </h2>
        <p className="text-xs text-muted">
          Pick the palette and titling font that fits this film. Applies
          instantly to the landing page and data room.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = t.id === project.themeId;
            return (
              <button
                key={t.id}
                onClick={() => save({ themeId: t.id })}
                disabled={saving}
                className={`flex flex-col gap-2 rounded-md border p-3 text-left transition-colors ${
                  active
                    ? "border-accent"
                    : "border-border hover:border-muted"
                }`}
                style={{ background: t.colors.background }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-4 w-4 rounded-full border border-white/10"
                    style={{ background: t.colors.accent }}
                  />
                  <span
                    className="font-display text-sm"
                    style={{ color: t.colors.foreground }}
                  >
                    Aa
                  </span>
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: t.colors.foreground }}
                >
                  {t.label}
                </span>
                <span
                  className="text-[10px] leading-snug"
                  style={{ color: t.colors.muted }}
                >
                  {t.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <label className="text-xs text-muted">Accent override</label>
          <input
            key={`${project.themeId}:${project.accentColor ?? ""}`}
            type="color"
            className="h-8 w-12 rounded border border-border bg-surface"
            defaultValue={currentAccent}
            onBlur={(e) => {
              if (e.target.value !== currentAccent) {
                save({ accentColor: e.target.value });
              }
            }}
          />
          {project.accentColor && (
            <button
              onClick={() => save({ accentColor: "" })}
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              Reset to theme default
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Titling font
        </h2>
        <p className="text-xs text-muted">
          Overrides the theme&apos;s suggested font. Used for the film title
          and section headings throughout.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save({ fontId: "" })}
            disabled={saving}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              !project.fontId
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Theme default ({theme.label})
          </button>
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => save({ fontId: f.id })}
              disabled={saving}
              style={{ fontFamily: `var(${f.fontVar})` }}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                project.fontId === f.id
                  ? "border-accent text-accent"
                  : "border-border text-foreground hover:border-muted"
              }`}
              title={f.description}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Landing page layout
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {LANDING_LAYOUTS.map((l) => {
            const active = l.id === project.landingLayout;
            return (
              <button
                key={l.id}
                onClick={() => save({ landingLayout: l.id })}
                disabled={saving}
                className={`flex flex-col gap-2 rounded-md border p-3 text-left transition-colors ${
                  active
                    ? "border-accent bg-surface"
                    : "border-border bg-surface hover:border-muted"
                }`}
              >
                <LayoutIcon variant={l.id} />
                <span className="text-xs font-medium">{l.label}</span>
                <span className="text-[10px] leading-snug text-muted">
                  {l.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Data room navigation
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROOM_LAYOUTS.map((l) => {
            const active = l.id === project.roomLayout;
            return (
              <button
                key={l.id}
                onClick={() => save({ roomLayout: l.id })}
                disabled={saving}
                className={`flex flex-col gap-2 rounded-md border p-3 text-left transition-colors ${
                  active
                    ? "border-accent bg-surface"
                    : "border-border bg-surface hover:border-muted"
                }`}
              >
                <RoomLayoutIcon variant={l.id} />
                <span className="text-xs font-medium">{l.label}</span>
                <span className="text-[10px] leading-snug text-muted">
                  {l.description}
                </span>
              </button>
            );
          })}
        </div>
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
          Logo
        </h2>
        <p className="text-xs text-muted">
          Shown instead of the production company name, on the landing page
          and in the room header. PNG, WebP or SVG, ideally transparent.
        </p>
        {project.logoKey && (
          <div className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-md border border-border bg-surface p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/projects/${project.slug}/logo?v=${logoVersion}`}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <input
          type="file"
          accept="image/png,image/webp,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLogoUpload(file);
          }}
          disabled={logoUploading}
          className="text-xs text-muted"
        />
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

function LayoutIcon({ variant }: { variant: string }) {
  const box = "rounded-sm bg-muted/30";
  if (variant === "split") {
    return (
      <div className="flex h-10 w-full gap-0.5 overflow-hidden rounded border border-border">
        <div className={`${box} w-1/2`} />
        <div className="flex w-1/2 flex-col items-center justify-center gap-0.5">
          <div className="h-1 w-6 rounded-full bg-muted/50" />
          <div className="h-1 w-4 rounded-full bg-muted/30" />
        </div>
      </div>
    );
  }
  if (variant === "full-bleed") {
    return (
      <div className={`relative h-10 w-full overflow-hidden rounded border border-border ${box}`}>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 bg-black/30 py-1">
          <div className="h-1 w-8 rounded-full bg-muted/60" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-10 w-full flex-col items-center justify-center gap-0.5 rounded border border-border">
      <div className="h-1 w-8 rounded-full bg-muted/50" />
      <div className="h-1 w-5 rounded-full bg-muted/30" />
    </div>
  );
}

function RoomLayoutIcon({ variant }: { variant: string }) {
  if (variant === "sidebar") {
    return (
      <div className="flex h-10 w-full gap-0.5 overflow-hidden rounded border border-border">
        <div className="flex w-1/3 flex-col gap-0.5 bg-muted/20 p-1">
          <div className="h-0.5 w-full rounded-full bg-muted/60" />
          <div className="h-0.5 w-full rounded-full bg-muted/30" />
          <div className="h-0.5 w-full rounded-full bg-muted/30" />
        </div>
        <div className="flex-1 bg-muted/10" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-full flex-col gap-0.5 overflow-hidden rounded border border-border">
      <div className="flex gap-1 bg-muted/20 p-1">
        <div className="h-0.5 w-4 rounded-full bg-muted/60" />
        <div className="h-0.5 w-4 rounded-full bg-muted/30" />
        <div className="h-0.5 w-4 rounded-full bg-muted/30" />
      </div>
      <div className="flex-1 bg-muted/10" />
    </div>
  );
}
