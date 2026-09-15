import Link from "next/link";
import { prisma } from "@/lib/db";

// This is an authenticated, per-visit page (the project list changes as
// you create/edit projects) — never prerender it as static, which would
// both bake in a stale snapshot and require a reachable database at build
// time rather than at request time.
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      productionCompany: true,
      isPublished: true,
      _count: { select: { documents: true, gallery: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Projects</h1>
        <Link
          href="/admin/projects/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity"
        >
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          No projects yet. Create your first film&apos;s data room.
        </p>
      ) : (
        <div className="mt-8 flex flex-col divide-y divide-border rounded-lg border border-border">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/admin/projects/${p.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-surface transition-colors"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {p.productionCompany} · /{p.slug} · {p._count.documents} docs
                  · {p._count.gallery} gallery items
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${
                  p.isPublished
                    ? "bg-accent/15 text-accent"
                    : "bg-border text-muted"
                }`}
              >
                {p.isPublished ? "Live" : "Draft"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
