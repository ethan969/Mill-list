"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function PasswordGateForm({
  slug,
  authPath,
  redirectPath,
}: {
  slug: string;
  /** Defaults to the room auth endpoint; pass a slate's to reuse this same form there. */
  authPath?: string;
  /** Where to send the browser once the password is accepted. Defaults to the room. */
  redirectPath?: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(authPath ?? `/api/room/${slug}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error || "Something went wrong. Try again.");
          return;
        }

        router.push(redirectPath ?? `/${slug}/room`);
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
      <div className="flex items-center gap-1 rounded-full border border-border bg-surface/80 p-1 pl-4 shadow-lg shadow-black/20 transition-colors focus-within:border-accent">
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted/50"
          placeholder="••••••••"
        />
        <button
          type="submit"
          disabled={isPending || password.length === 0}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-all disabled:opacity-40 disabled:hover:scale-100 hover:opacity-90 hover:scale-[1.03]"
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
