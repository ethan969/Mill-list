"use client";

import { useState } from "react";

export default function DownloadModal({
  documentId,
  documentTitle,
  onClose,
}: {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(`/api/documents/${documentId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't send that email.");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setError("Network error. Try again.");
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-border bg-surface-raised p-6"
      >
        {status === "sent" ? (
          <>
            <h3 className="font-display text-xl">Check your inbox</h3>
            <p className="mt-2 text-sm text-foreground/90">
              We&apos;ve sent a watermarked copy of{" "}
              <strong>{documentTitle}</strong> to <strong>{email}</strong>.
              The link expires in 7 days.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-md border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h3 className="font-display text-xl">Email {documentTitle}</h3>
            <p className="mt-2 text-xs text-muted">
              We&apos;ll email you a link to a watermarked copy, addressed to
              you. By requesting it, you agree to keep these materials
              confidential.
            </p>
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
              <input
                type="email"
                required
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {status === "loading" ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
