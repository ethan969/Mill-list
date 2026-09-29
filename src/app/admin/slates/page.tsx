import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminSlatesDashboard() {
  const slates = await prisma.slate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      isPublished: true,
      _count: { select: { projects: true, documents: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Slates</h1>
        <Link
          href="/admin/slates/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity"
        >
          New slate
        </Link>
      </div>

      {slates.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          No slates yet. A slate is a curated, password-protected collection
          of films — useful for a buyer or festival that should see several
          titles under one login.
        </p>
      ) : (
        <div className="mt-8 flex flex-col divide-y divide-border rounded-lg border border-border">
          {slates.map((s) => (
            <Link
              key={s.id}
              href={`/admin/slates/${s.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-surface transition-colors"
            >
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  /slate/{s.slug} · {s._count.projects} films ·{" "}
                  {s._count.documents} documents
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wide ${
                  s.isPublished
                    ? "bg-accent/15 text-accent"
                    : "bg-border text-muted"
                }`}
              >
                {s.isPublished ? "Live" : "Draft"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
