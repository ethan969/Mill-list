"use client";

import { useState } from "react";
import { inputClass, Field } from "@/components/admin/FormField";
import type { AdminFinanceSource, AdminProject } from "@/components/admin/types";
import {
  CURRENCIES,
  CURRENCY_SYMBOLS,
  FINANCE_SOURCE_STATUSES,
  FINANCE_SOURCE_TYPES,
  financeSourceStatusLabel,
  financeSourceTypeLabel,
  type CurrencyOption,
} from "@/lib/finance-options";
import { formatMoneyMinorToMajor } from "@/lib/money";

const EMPTY_SOURCE_FORM = {
  name: "",
  type: FINANCE_SOURCE_TYPES[0].value as string,
  amount: "",
  status: FINANCE_SOURCE_STATUSES[0].value as string,
};

export default function FinancePanel({
  project,
  onUpdate,
}: {
  project: AdminProject;
  onUpdate: (patch: Partial<AdminProject>) => void;
}) {
  const [form, setForm] = useState({
    currency: project.currency ?? "",
    grossBudget:
      project.grossBudget !== null ? formatMoneyMinorToMajor(project.grossBudget) : "",
    equitySought:
      project.equitySought !== null
        ? formatMoneyMinorToMajor(project.equitySought)
        : "",
    minimumTicket:
      project.minimumTicket !== null
        ? formatMoneyMinorToMajor(project.minimumTicket)
        : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE_FORM);
  const [addingSource, setAddingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const sources = [...project.financeSources].sort((a, b) => a.order - b.order);
  const currencySymbol = form.currency
    ? CURRENCY_SYMBOLS[form.currency as CurrencyOption]
    : "";

  const totalSources = sources.reduce((sum, s) => sum + s.amount, 0);
  const committedTotal = sources
    .filter((s) => s.status === "COMMITTED")
    .reduce((sum, s) => sum + s.amount, 0);
  const inNegotiationTotal = sources
    .filter((s) => s.status === "IN_NEGOTIATION")
    .reduce((sum, s) => sum + s.amount, 0);
  const soughtTotal = sources
    .filter((s) => s.status === "SOUGHT")
    .reduce((sum, s) => sum + s.amount, 0);

  const budgetMinor = project.grossBudget;
  const hasRealBudget = budgetMinor !== null && budgetMinor > 0;
  const percentFinanced = hasRealBudget ? (totalSources / budgetMinor) * 100 : null;
  const reconciles = !hasRealBudget || totalSources === budgetMinor;
  const gap = hasRealBudget ? budgetMinor - totalSources : null;

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save changes.");
        return;
      }
      onUpdate(data.project);
      setMessage("Saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    setAddingSource(true);
    setSourceError(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/finance/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSourceError(data.error || "Couldn't add that source.");
        return;
      }
      onUpdate({ financeSources: [...project.financeSources, data.source] });
      setSourceForm(EMPTY_SOURCE_FORM);
    } catch {
      setSourceError("Network error.");
    } finally {
      setAddingSource(false);
    }
  }

  async function handleDeleteSource(id: string) {
    const res = await fetch(
      `/api/admin/projects/${project.id}/finance/sources/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onUpdate({
        financeSources: project.financeSources.filter((s) => s.id !== id),
      });
    }
  }

  async function persistOrder(next: AdminFinanceSource[]) {
    setReordering(true);
    setSourceError(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/finance/sources`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((s) => s.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSourceError(data.error || "Couldn't save the new order.");
        return;
      }
      onUpdate({ financeSources: next.map((s, i) => ({ ...s, order: i })) });
    } catch {
      setSourceError("Network error.");
    } finally {
      setReordering(false);
    }
  }

  function moveSource(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sources.length) return;
    const next = [...sources];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    persistOrder(next);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl">Finance</h2>
            <p className="mt-1 text-xs text-muted">
              Shown on this film&apos;s capital stack, and rolled up into its
              slate&apos;s Finance panel, once authenticated with the
              slate&apos;s password.
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
          label="Currency"
          hint="Clearing this turns off finance tracking for this film entirely."
        >
          <select
            className={inputClass}
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          >
            <option value="">Not tracked</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Gross budget" hint={currencySymbol ? `${currencySymbol} minor units entered as e.g. 1250000.00` : undefined}>
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="1250000.00"
            value={form.grossBudget}
            onChange={(e) => setForm((f) => ({ ...f, grossBudget: e.target.value }))}
          />
        </Field>

        <Field label="Equity sought">
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="500000.00"
            value={form.equitySought}
            onChange={(e) =>
              setForm((f) => ({ ...f, equitySought: e.target.value }))
            }
          />
        </Field>

        <Field
          label="Minimum ticket"
          hint="Optional — leave blank to show 'Contact us' instead of a figure."
        >
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="25000.00"
            value={form.minimumTicket}
            onChange={(e) =>
              setForm((f) => ({ ...f, minimumTicket: e.target.value }))
            }
          />
        </Field>

        {error && <p className="text-xs text-danger">{error}</p>}
        {message && <p className="text-xs text-accent">{message}</p>}

        {project.financeUpdatedAt && (
          <p className="text-[11px] text-muted">
            Last updated {new Date(project.financeUpdatedAt).toLocaleString()}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <div>
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted">
            Capital stack
          </h3>
          <p className="mt-1 text-xs text-muted">
            Every source that makes up this film&apos;s financing, in the
            currency above.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Committed" value={committedTotal} symbol={currencySymbol} />
          <Stat
            label="In negotiation"
            value={inNegotiationTotal}
            symbol={currencySymbol}
          />
          <Stat label="Sought" value={soughtTotal} symbol={currencySymbol} />
          <Stat
            label="% financed"
            value={percentFinanced !== null ? `${percentFinanced.toFixed(1)}%` : "—"}
            symbol=""
          />
        </div>

        {hasRealBudget && !reconciles && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Sources total {currencySymbol}
            {formatMoneyMinorToMajor(totalSources)}, which is {currencySymbol}
            {formatMoneyMinorToMajor(Math.abs(gap ?? 0))}{" "}
            {(gap ?? 0) < 0 ? "over" : "under"} the {currencySymbol}
            {formatMoneyMinorToMajor(budgetMinor)} budget.
          </p>
        )}

        {sourceError && <p className="text-xs text-danger">{sourceError}</p>}

        {sources.length > 0 ? (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {sources.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{s.name}</p>
                  <p className="text-xs text-muted">
                    {financeSourceTypeLabel(s.type)} ·{" "}
                    {financeSourceStatusLabel(s.status)} · {currencySymbol}
                    {formatMoneyMinorToMajor(s.amount)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => moveSource(i, -1)}
                    disabled={reordering || i === 0}
                    className="text-xs text-muted hover:text-accent disabled:opacity-30 transition-colors"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveSource(i, 1)}
                    disabled={reordering || i === sources.length - 1}
                    className="text-xs text-muted hover:text-accent disabled:opacity-30 transition-colors"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleDeleteSource(s.id)}
                    className="text-xs text-danger hover:opacity-70 transition-opacity"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No sources added yet.</p>
        )}

        <form
          onSubmit={handleAddSource}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              placeholder="Source name, e.g. BFI Production Fund"
              className={inputClass}
              value={sourceForm.name}
              onChange={(e) =>
                setSourceForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
            <input
              placeholder={`Amount, e.g. 50000.00`}
              inputMode="decimal"
              className={inputClass}
              value={sourceForm.amount}
              onChange={(e) =>
                setSourceForm((f) => ({ ...f, amount: e.target.value }))
              }
              required
            />
            <select
              className={inputClass}
              value={sourceForm.type}
              onChange={(e) =>
                setSourceForm((f) => ({ ...f, type: e.target.value }))
              }
            >
              {FINANCE_SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={sourceForm.status}
              onChange={(e) =>
                setSourceForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              {FINANCE_SOURCE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={addingSource}
            className="self-start rounded-md border border-border px-4 py-2 text-xs hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
          >
            {addingSource ? "Adding…" : "Add source"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  symbol,
}: {
  label: string;
  value: number | string;
  symbol: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted">{label}</p>
      <p className="mt-1 text-sm">
        {typeof value === "number" ? `${symbol}${formatMoneyMinorToMajor(value)}` : value}
      </p>
    </div>
  );
}
