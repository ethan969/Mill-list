"use client";

import { useState } from "react";
import { inputClass, Field, slugify } from "@/components/admin/FormField";
import type { AdminSlate } from "@/components/admin/types";
import { THEMES, FONTS, getTheme } from "@/lib/themes";

export default function SlateDetailsPanel({
  slate,
  onUpdate,
}: {
  slate: AdminSlate;
  onUpdate: (patch: Partial<AdminSlate>) => void;
}) {
  const [form, setForm] = useState({
    title: slate.title,
    slug: slate.slug,
    overview: slate.overview ?? "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const theme = getTheme(slate.themeId);
  const currentAccent = slate.accentColor || theme.colors.accent;

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/slates/${slate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save changes.");
        return;
      }
      onUpdate(data.slate);
      setMessage("Saved.");
      setNewPassword("");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeSessions() {
    if (
      !confirm(
        "Sign out everyone currently viewing this slate? They'll need to enter the password again."
      )
    ) {
      return;
    }
    setRevoking(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/slates/${slate.id}/revoke-sessions`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't revoke sessions.");
        return;
      }
      setMessage("Every slate viewer session has been signed out.");
    } catch {
      setError("Network error.");
    } finally {
      setRevoking(false);
    }
  }

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/slate/${form.slug}`
      : `/slate/${form.slug}`;

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

        <Field label="Slate title">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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

        <Field label="Overview" hint="Shown to whoever opens the slate">
          <textarea
            className={`${inputClass} min-h-24`}
            value={form.overview}
            onChange={(e) =>
              setForm((f) => ({ ...f, overview: e.target.value }))
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = t.id === slate.themeId;
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
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-3">
          <label className="text-xs text-muted">Accent override</label>
          <input
            key={`${slate.themeId}:${slate.accentColor ?? ""}`}
            type="color"
            className="h-8 w-12 rounded border border-border bg-surface"
            defaultValue={currentAccent}
            onBlur={(e) => {
              if (e.target.value !== currentAccent) {
                save({ accentColor: e.target.value });
              }
            }}
          />
          {slate.accentColor && (
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save({ fontId: "" })}
            disabled={saving}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              !slate.fontId
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
                slate.fontId === f.id
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
          Publish
        </h2>
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm">{slate.isPublished ? "Live" : "Draft"}</p>
            <p className="text-xs text-muted">
              {slate.isPublished
                ? "Anyone with the link and password can access this slate."
                : "The slate is hidden until you publish it."}
            </p>
          </div>
          <button
            onClick={() => save({ isPublished: !slate.isPublished })}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent transition-colors"
          >
            {slate.isPublished ? "Unpublish" : "Publish"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          Slate password
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
        <p className="text-xs text-muted">
          Changing the password automatically signs out everyone currently
          viewing this slate.
        </p>

        <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
          <div>
            <p className="text-sm">Revoke all slate sessions</p>
            <p className="text-xs text-muted">
              Signs everyone out immediately, without changing the password.
            </p>
          </div>
          <button
            onClick={handleRevokeSessions}
            disabled={revoking}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-danger hover:border-danger transition-colors disabled:opacity-40"
          >
            {revoking ? "Revoking…" : "Revoke"}
          </button>
        </div>
      </section>
    </div>
  );
}
