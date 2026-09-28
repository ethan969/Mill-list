"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyTwoFactorPage() {
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useRecovery ? { recoveryCode: code } : { code }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Incorrect code.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-2xl">Enter your code</p>
        <p className="mt-2 text-center text-sm text-muted">
          {useRecovery
            ? "Enter one of your saved recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="text"
            inputMode={useRecovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            required
            placeholder={useRecovery ? "XXXX-XXXX" : "123456"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2.5 text-center text-lg tracking-[0.2em] outline-none focus:border-accent transition-colors"
          />
          {error && <p className="text-center text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
        <button
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode("");
            setError(null);
          }}
          className="mt-4 w-full text-center text-xs text-muted hover:text-accent transition-colors"
        >
          {useRecovery ? "Use an authenticator code instead" : "Use a recovery code instead"}
        </button>
      </div>
    </div>
  );
}
