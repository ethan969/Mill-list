"use client";

import { useEffect, useState } from "react";

type Download = {
  id: string;
  email: string;
  emailSent: boolean;
  linkOpened: boolean;
  createdAt: string;
  document: { title: string; section: string };
};

export default function LeadsPanel({ projectId }: { projectId: string }) {
  const [downloads, setDownloads] = useState<Download[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/projects/${projectId}/downloads`)
      .then((r) => r.json())
      .then((data) => setDownloads(data.downloads ?? []));
  }, [projectId]);

  function exportCsv() {
    if (!downloads) return;
    const rows = [
      ["Email", "Document", "Section", "Email sent", "Link opened", "Date"],
      ...downloads.map((d) => [
        d.email,
        d.document.title,
        d.document.section,
        d.emailSent ? "yes" : "no",
        d.linkOpened ? "yes" : "no",
        new Date(d.createdAt).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Leads</h2>
        <button
          onClick={exportCsv}
          disabled={!downloads || downloads.length === 0}
          className="rounded-md border border-border px-4 py-2 text-xs hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Everyone who has requested a watermarked document by email.
      </p>

      {downloads === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : downloads.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No downloads yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {downloads.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">{d.email}</td>
                  <td className="px-4 py-3">{d.document.title}</td>
                  <td className="px-4 py-3 text-muted">
                    {!d.emailSent
                      ? "Failed to send"
                      : d.linkOpened
                        ? "Opened"
                        : "Sent"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
