"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/components/admin/FormField";
import type { AdminSlate, AdminSlateMember } from "@/components/admin/types";

type ProjectOption = { id: string; title: string; productionCompany: string };

export default function SlateFilmsPanel({
  slate,
  onUpdate,
}: {
  slate: AdminSlate;
  onUpdate: (patch: Partial<AdminSlate>) => void;
}) {
  const members = [...slate.projects].sort((a, b) => a.order - b.order);
  const [allProjects, setAllProjects] = useState<ProjectOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/projects")
      .then((res) => res.json())
      .then((data) => setAllProjects(data.projects ?? []))
      .catch(() => {});
  }, []);

  const memberIds = new Set(members.map((m) => m.projectId));
  const available = allProjects.filter((p) => !memberIds.has(p.id));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/slates/${slate.id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't add that film.");
        return;
      }
      const membership: AdminSlateMember = {
        projectId: data.membership.projectId,
        order: data.membership.order,
        project: data.membership.project,
      };
      onUpdate({ projects: [...slate.projects, membership] });
      setSelectedId("");
    } catch {
      setError("Network error.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(projectId: string) {
    if (!confirm("Remove this film from the slate? Existing slate viewers lose access to it immediately."))
      return;
    const res = await fetch(`/api/admin/slates/${slate.id}/projects/${projectId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onUpdate({ projects: slate.projects.filter((m) => m.projectId !== projectId) });
    }
  }

  async function persistOrder(next: AdminSlateMember[]) {
    setReordering(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/slates/${slate.id}/projects`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((m) => m.projectId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't save the new order.");
        return;
      }
      onUpdate({
        projects: next.map((m, i) => ({ ...m, order: i })),
      });
    } catch {
      setError("Network error.");
    } finally {
      setReordering(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= members.length) return;
    const next = [...members];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    persistOrder(next);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h2 className="font-display text-2xl">Films</h2>
        <p className="mt-1 text-sm text-muted">
          Films visible to anyone who opens this slate with its password.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4"
      >
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={`${inputClass} flex-1`}
        >
          <option value="">Select a film to add…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.productionCompany})
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!selectedId || adding}
          className="rounded-md bg-accent px-4 py-2.5 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>

      {error && <p className="text-xs text-danger">{error}</p>}

      {members.length > 0 ? (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {members.map((m, i) => (
            <div
              key={m.projectId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm">{m.project.title}</p>
                <p className="text-xs text-muted">{m.project.productionCompany}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => move(i, -1)}
                  disabled={reordering || i === 0}
                  className="text-xs text-muted hover:text-accent disabled:opacity-30 transition-colors"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={reordering || i === members.length - 1}
                  className="text-xs text-muted hover:text-accent disabled:opacity-30 transition-colors"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleRemove(m.projectId)}
                  className="text-xs text-danger hover:opacity-70 transition-opacity"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No films in this slate yet.</p>
      )}
    </div>
  );
}
