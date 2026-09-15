"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DOCUMENT_SECTIONS } from "@/lib/sections";
import type { AdminProject } from "@/components/admin/types";
import DetailsPanel from "@/components/admin/DetailsPanel";
import DocumentsPanel from "@/components/admin/DocumentsPanel";
import AboutPanel from "@/components/admin/AboutPanel";
import GalleryPanel from "@/components/admin/GalleryPanel";
import LeadsPanel from "@/components/admin/LeadsPanel";

const TABS = [
  { key: "details", label: "Details" },
  ...DOCUMENT_SECTIONS.map((s) => ({ key: s.slug, label: s.label })),
  { key: "about", label: "About Us" },
  { key: "gallery", label: "Gallery & References" },
  { key: "leads", label: "Leads" },
];

export default function ProjectEditClient({
  initialProject,
}: {
  initialProject: AdminProject;
}) {
  const [project, setProject] = useState(initialProject);
  const [tab, setTab] = useState("details");
  const router = useRouter();

  function onUpdate(patch: Partial<AdminProject>) {
    setProject((p) => ({ ...p, ...patch }));
  }

  async function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${project.title}" and all its files? This can't be undone.`
      )
    )
      return;
    const res = await fetch(`/api/admin/projects/${project.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/admin");
  }

  const section = DOCUMENT_SECTIONS.find((s) => s.slug === tab);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-xs text-muted hover:text-accent">
            ← All projects
          </Link>
          <h1 className="mt-2 font-display text-3xl">{project.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {project.isPublished && (
            <a
              href={`/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              View room ↗
            </a>
          )}
          <button
            onClick={handleDelete}
            className="text-xs text-danger hover:opacity-70 transition-opacity"
          >
            Delete project
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
          <DetailsPanel project={project} onUpdate={onUpdate} />
        )}
        {section && (
          <DocumentsPanel
            project={project}
            section={section}
            onUpdate={onUpdate}
          />
        )}
        {tab === "about" && <AboutPanel project={project} onUpdate={onUpdate} />}
        {tab === "gallery" && (
          <GalleryPanel project={project} onUpdate={onUpdate} />
        )}
        {tab === "leads" && <LeadsPanel projectId={project.id} />}
      </div>
    </div>
  );
}
