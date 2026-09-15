"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function PasswordGateForm({ slug }: { slug: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/room/${slug}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error || "Something went wrong. Try again.");
          return;
        }

        router.push(`/${slug}/room`);
        router.refresh();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs">
      <label
        htmlFor="password"
        className="block text-[11px] uppercase tracking-[0.2em] text-muted mb-2"
      >
        Enter password
      </label>
      <div className="flex gap-2">
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent transition-colors"
          placeholder="••••••••"
        />
        <button
          type="submit"
          disabled={isPending || password.length === 0}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          {isPending ? "…" : "Enter"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
