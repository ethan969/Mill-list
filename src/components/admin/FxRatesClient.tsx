"use client";

import { useState } from "react";
import { inputClass } from "@/components/admin/FormField";
import type { AdminFxRate } from "@/components/admin/types";
import { CURRENCIES } from "@/lib/finance-options";

const today = () => new Date().toISOString().slice(0, 10);

export default function FxRatesClient({
  initialRates,
}: {
  initialRates: AdminFxRate[];
}) {
  const [rates, setRates] = useState(initialRates);
  const [form, setForm] = useState({
    from: CURRENCIES[0] as string,
    to: CURRENCIES[1] as string,
    rate: "",
    asOfDate: today(),
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fx-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't add that rate.");
        return;
      }
      setRates((r) => [data.rate, ...r]);
      setForm((f) => ({ ...f, rate: "" }));
    } catch {
      setError("Network error.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/fx-rates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRates((r) => r.filter((row) => row.id !== id));
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl">FX rates</h1>
      <p className="mt-2 text-sm text-muted">
        Used to convert each film&apos;s finance totals into a slate&apos;s
        display currency (src/lib/finance.ts). A missing rate for a needed
        pair shows as an explicit error on the slate&apos;s Finance panel —
        it&apos;s never guessed, inverted from the reverse pair, or chained
        through a third currency.
      </p>

      <form
        onSubmit={handleAdd}
        className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-end sm:flex-wrap"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
            From
          </span>
          <select
            className={inputClass}
            value={form.from}
            onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
            To
          </span>
          <select
            className={inputClass}
            value={form.to}
            onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
            Rate
          </span>
          <input
            placeholder="1.27000000"
            inputMode="decimal"
            className={inputClass}
            value={form.rate}
            onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted">
            As of
          </span>
          <input
            type="date"
            className={inputClass}
            value={form.asOfDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, asOfDate: e.target.value }))
            }
            required
          />
        </label>
        <button
          type="submit"
          disabled={adding || form.from === form.to}
          className="rounded-md bg-accent px-4 py-2.5 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {adding ? "Adding…" : "Add rate"}
        </button>
      </form>
      {form.from === form.to && (
        <p className="mt-2 text-xs text-muted">
          From and To must be different currencies.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {rates.length > 0 ? (
        <div className="mt-6 flex flex-col divide-y divide-border rounded-lg border border-border">
          {rates.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm tabular-nums">
                  1 {r.from} = {r.rate} {r.to}
                </p>
                <p className="text-xs text-muted">
                  As of {new Date(r.asOfDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                className="shrink-0 text-xs text-danger hover:opacity-70 transition-opacity"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">No FX rates added yet.</p>
      )}
    </div>
  );
}
