"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { inputClass, Field } from "@/components/admin/FormField";
import DocumentsPanel from "@/components/admin/DocumentsPanel";
import type { AdminProject, TeamMember } from "@/components/admin/types";
import { sectionByKey } from "@/lib/sections";

const CREATIVE_DECK_SECTION = sectionByKey("CREATIVE_DECK");

// Everything shown on this film's own page within the slate (src/app/slate/
// [slug]/[projectSlug]): logline, team, approximate budget, ideal shooting
// window, and the deck. Edits go straight to the project itself — the same
// fields (and the same Creative Deck document) the project's own room
// would use, so there's nothing slate-specific to keep in sync.
export default function SlateFilmDetailsPanel({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const [project, setProject] = useState<AdminProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({
    logline: "",
    approximateBudget: "",
    idealShootWindow: "",
  });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // The parent renders this component keyed by projectId, so a film
    // switch remounts it fresh — no need to reset loading/error state here.
    let cancelled = false;
    fetch(`/api/admin/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.project) {
          setLoadError("Couldn't load this film.");
          return;
        }
        setProject(data.project);
        setForm({
          logline: data.project.logline ?? "",
          approximateBudget: data.project.approximateBudget ?? "",
          idealShootWindow: data.project.idealShootWindow ?? "",
        });
        setTeam(data.project.aboutTeam ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Network error.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function updateMember(i: number, patch: Partial<TeamMember>) {
    setTeam((t) => t.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function save() {
    if (!project) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, aboutTeam: team }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save changes.");
        return;
      }
      // The PATCH response is the bare updated row, without the
      // documents/gallery/references/_count relations the initial GET
      // included — merge onto the existing project rather than replacing
      // it, so DocumentsPanel below doesn't lose its documents array.
      setProject((p) => (p ? { ...p, ...data.project } : data.project));
      setMessage("Saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading {projectTitle}…</p>;
  }
  if (loadError || !project) {
    return <p className="text-sm text-danger">{loadError || "Not found."}</p>;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">{project.title}</h2>
          <p className="mt-1 text-xs text-muted">
            Shown on this film&apos;s page within every slate it belongs to.
          </p>
        </div>
        <Link
          href={`/admin/projects/${project.id}`}
          className="text-xs text-muted hover:text-accent transition-colors"
        >
          Full project settings →
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted">
            Pitch details
          </h3>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <Field label="Logline">
          <textarea
            className={`${inputClass} min-h-20`}
            value={form.logline}
            onChange={(e) => setForm((f) => ({ ...f, logline: e.target.value }))}
          />
        </Field>

        <Field label="Approximate budget" hint='e.g. "$2M – $4M"'>
          <input
            className={inputClass}
            value={form.approximateBudget}
            onChange={(e) =>
              setForm((f) => ({ ...f, approximateBudget: e.target.value }))
            }
          />
        </Field>

        <Field label="Ideal shooting window" hint='e.g. "Spring 2026"'>
          <input
            className={inputClass}
            value={form.idealShootWindow}
            onChange={(e) =>
              setForm((f) => ({ ...f, idealShootWindow: e.target.value }))
            }
          />
        </Field>

        {error && <p className="text-xs text-danger">{error}</p>}
        {message && <p className="text-xs text-accent">{message}</p>}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted">Team</h3>
        <div className="flex flex-col gap-4">
          {team.map((member, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4"
            >
              <div className="flex gap-2">
                <input
                  placeholder="Name"
                  className={`${inputClass} flex-1`}
                  value={member.name}
                  onChange={(e) => updateMember(i, { name: e.target.value })}
                />
                <input
                  placeholder="Role"
                  className={`${inputClass} flex-1`}
                  value={member.role ?? ""}
                  onChange={(e) => updateMember(i, { role: e.target.value })}
                />
              </div>
              <textarea
                placeholder="Short bio"
                className={`${inputClass} min-h-16`}
                value={member.bio ?? ""}
                onChange={(e) => updateMember(i, { bio: e.target.value })}
              />
              <button
                onClick={() => setTeam((t) => t.filter((_, idx) => idx !== i))}
                className="self-start text-xs text-danger hover:opacity-70 transition-opacity"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setTeam((t) => [...t, { name: "", role: "", bio: "" }])}
          className="self-start text-xs text-muted hover:text-accent transition-colors"
        >
          + Add team member
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="self-start rounded-md border border-border px-4 py-1.5 text-xs hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save team"}
        </button>
      </section>

      <div className="border-t border-border pt-6">
        <DocumentsPanel
          project={project}
          section={CREATIVE_DECK_SECTION}
          onUpdate={(patch) => setProject((p) => (p ? { ...p, ...patch } : p))}
        />
      </div>
    </div>
  );
}
