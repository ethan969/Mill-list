"use client";

import { useState } from "react";
import { inputClass, Field } from "@/components/admin/FormField";
import type { AdminProject, TeamMember } from "@/components/admin/types";

export default function AboutPanel({
  project,
  onUpdate,
}: {
  project: AdminProject;
  onUpdate: (patch: Partial<AdminProject>) => void;
}) {
  const [aboutContent, setAboutContent] = useState(project.aboutContent ?? "");
  const [team, setTeam] = useState<TeamMember[]>(project.aboutTeam ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aboutContent, aboutTeam: team }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save.");
        return;
      }
      onUpdate(data.project);
      setMessage("Saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function updateMember(i: number, patch: Partial<TeamMember>) {
    setTeam((t) => t.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">About Us</h2>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <Field
        label="Company blurb"
        hint="Separate paragraphs with a blank line"
      >
        <textarea
          className={`${inputClass} min-h-40`}
          value={aboutContent}
          onChange={(e) => setAboutContent(e.target.value)}
        />
      </Field>

      <div>
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted">
          Team
        </p>
        <div className="mt-3 flex flex-col gap-4">
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
          className="mt-3 text-xs text-muted hover:text-accent transition-colors"
        >
          + Add team member
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {message && <p className="text-xs text-accent">{message}</p>}
    </div>
  );
}
