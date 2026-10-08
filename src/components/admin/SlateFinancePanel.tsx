"use client";

import { useState } from "react";
import { inputClass, Field } from "@/components/admin/FormField";
import type { AdminSlate } from "@/components/admin/types";
import { CURRENCIES, RECOUPMENT_STRUCTURES } from "@/lib/finance-options";

export default function SlateFinancePanel({
  slate,
  onUpdate,
}: {
  slate: AdminSlate;
  onUpdate: (patch: Partial<AdminSlate>) => void;
}) {
  const [form, setForm] = useState({
    recoupmentStructure: slate.recoupmentStructure ?? "",
    recoupmentNote: slate.recoupmentNote ?? "",
    disclaimerText: slate.disclaimerText ?? "",
    financeDisplayCurrency: slate.financeDisplayCurrency,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/slates/${slate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save changes.");
        return;
      }
      onUpdate(data.slate);
      setMessage("Saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Finance settings</h2>
          <p className="mt-1 text-xs text-muted">
            Controls the Finance panel shown on this slate&apos;s Overview,
            once a visitor has entered the slate password — see each film&apos;s
            own Finance tab for its budget and capital stack.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <Field
        label="Display currency"
        hint="Every member film's totals are converted into this currency using the stored FX rates."
      >
        <select
          className={inputClass}
          value={form.financeDisplayCurrency}
          onChange={(e) =>
            setForm((f) => ({ ...f, financeDisplayCurrency: e.target.value }))
          }
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Recoupment structure">
        <select
          className={inputClass}
          value={form.recoupmentStructure}
          onChange={(e) =>
            setForm((f) => ({ ...f, recoupmentStructure: e.target.value }))
          }
        >
          <option value="">Not set — statement hidden on the viewer</option>
          {RECOUPMENT_STRUCTURES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {form.recoupmentStructure && (
          <p className="mt-1 text-[11px] text-muted">
            {
              RECOUPMENT_STRUCTURES.find(
                (r) => r.value === form.recoupmentStructure
              )?.description
            }
          </p>
        )}
      </Field>

      <Field
        label="Recoupment note"
        hint="Plain-language explanation shown alongside the structure above — e.g. which films are cross-collateralised."
      >
        <textarea
          className={`${inputClass} min-h-24`}
          value={form.recoupmentNote}
          onChange={(e) =>
            setForm((f) => ({ ...f, recoupmentNote: e.target.value }))
          }
        />
      </Field>

      <Field
        label="Disclaimer"
        hint="Shown at the foot of the Finance panel — investment risk wording, etc."
      >
        <textarea
          className={`${inputClass} min-h-24`}
          value={form.disclaimerText}
          onChange={(e) =>
            setForm((f) => ({ ...f, disclaimerText: e.target.value }))
          }
        />
      </Field>

      {error && <p className="text-xs text-danger">{error}</p>}
      {message && <p className="text-xs text-accent">{message}</p>}
    </div>
  );
}
