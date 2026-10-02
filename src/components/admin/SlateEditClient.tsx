"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminSlate } from "@/components/admin/types";
import SlateDetailsPanel from "@/components/admin/SlateDetailsPanel";
import SlateFilmsPanel from "@/components/admin/SlateFilmsPanel";
import SlateFilmDetailsPanel from "@/components/admin/SlateFilmDetailsPanel";
import SlateFinancePanel from "@/components/admin/SlateFinancePanel";

const FILM_TAB_PREFIX = "film:";

export default function SlateEditClient({
  initialSlate,
}: {
  initialSlate: AdminSlate;
}) {
  const [slate, setSlate] = useState(initialSlate);
  const [tab, setTab] = useState("details");
  const router = useRouter();

  function onUpdate(patch: Partial<AdminSlate>) {
    setSlate((s) => ({ ...s, ...patch }));
  }

  async function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${slate.title}"? This can't be undone. Films that belong to it, and their own decks, are not affected.`
      )
    )
      return;
    const res = await fetch(`/api/admin/slates/${slate.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/admin/slates");
  }

  const films = [...slate.projects].sort((a, b) => a.order - b.order);
  const activeFilm = tab.startsWith(FILM_TAB_PREFIX)
    ? films.find((f) => tab === `${FILM_TAB_PREFIX}${f.projectId}`)
    : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/slates" className="text-xs text-muted hover:text-accent">
            ← All slates
          </Link>
          <h1 className="mt-2 font-display text-3xl">{slate.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {slate.isPublished && (
            <a
              href={`/slate/${slate.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              View slate ↗
            </a>
          )}
          <button
            onClick={handleDelete}
            className="text-xs text-danger hover:opacity-70 transition-opacity"
          >
            Delete slate
          </button>
        </div>
      </div>

      <nav className="mt-8 flex gap-5 overflow-x-auto border-b border-border pb-px text-sm">
        <button
          onClick={() => setTab("details")}
          className={`whitespace-nowrap border-b-2 pb-3 transition-colors ${
            tab === "details"
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setTab("films")}
          className={`whitespace-nowrap border-b-2 pb-3 transition-colors ${
            tab === "films"
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Films
        </button>
        <button
          onClick={() => setTab("finance")}
          className={`whitespace-nowrap border-b-2 pb-3 transition-colors ${
            tab === "finance"
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Finance
        </button>
        {films.map((f) => {
          const key = `${FILM_TAB_PREFIX}${f.projectId}`;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`whitespace-nowrap border-b-2 pb-3 transition-colors ${
                tab === key
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {f.project.title}
            </button>
          );
        })}
      </nav>

      <div className="mt-8">
        {tab === "details" && (
          <SlateDetailsPanel slate={slate} onUpdate={onUpdate} />
        )}
        {tab === "films" && <SlateFilmsPanel slate={slate} onUpdate={onUpdate} />}
        {tab === "finance" && (
          <SlateFinancePanel slate={slate} onUpdate={onUpdate} />
        )}
        {tab.startsWith(FILM_TAB_PREFIX) &&
          (activeFilm ? (
            <SlateFilmDetailsPanel
              key={activeFilm.projectId}
              projectId={activeFilm.projectId}
              projectTitle={activeFilm.project.title}
            />
          ) : (
            <p className="text-sm text-muted">
              This film is no longer in the slate.
            </p>
          ))}
      </div>
    </div>
  );
}
