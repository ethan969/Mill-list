"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, slugify, Field } from "@/components/admin/FormField";

export default function NewSlatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [overview, setOverview] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/slates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, overview, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push(`/admin/slates/${data.slate.id}`);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl">New slate</h1>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Field label="Slate title">
          <input
            required
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="URL slug" hint="yourdomain.com/slate/this-slug">
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="Overview" hint="Optional, shown to whoever opens the slate">
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            className={`${inputClass} min-h-24`}
          />
        </Field>

        <Field label="Slate password">
          <input
            required
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </Field>

        {error && <p className="text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {loading ? "Creating…" : "Create slate"}
        </button>
      </form>
    </div>
  );
}
