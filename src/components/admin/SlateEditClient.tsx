"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DOCUMENT_SECTIONS } from "@/lib/sections";
import type { AdminSlate } from "@/components/admin/types";
import SlateDetailsPanel from "@/components/admin/SlateDetailsPanel";
import SlateFilmsPanel from "@/components/admin/SlateFilmsPanel";
import SlateDocumentsPanel from "@/components/admin/SlateDocumentsPanel";

const TABS = [
  { key: "details", label: "Details" },
  { key: "films", label: "Films" },
  ...DOCUMENT_SECTIONS.map((s) => ({ key: s.slug, label: s.label })),
];

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
        `Permanently delete "${slate.title}" and all its slate-level documents? This can't be undone. Films that belong to it are not affected.`
      )
    )
      return;
    const res = await fetch(`/api/admin/slates/${slate.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/admin/slates");
  }

  const section = DOCUMENT_SECTIONS.find((s) => s.slug === tab);

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
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 pb-3 transition-colors ${
              tab === t.key
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "details" && (
          <SlateDetailsPanel slate={slate} onUpdate={onUpdate} />
        )}
        {tab === "films" && <SlateFilmsPanel slate={slate} onUpdate={onUpdate} />}
        {section && (
          <SlateDocumentsPanel slate={slate} section={section} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}
