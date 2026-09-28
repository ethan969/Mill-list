"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupTwoFactorPage() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/2fa/setup")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error || "Couldn't start 2FA setup.");
          return;
        }
        setQrDataUrl(data.qrDataUrl);
        setSecret(data.secret);
      })
      .catch(() => setLoadError("Network error."));
  }, []);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Incorrect code.");
        setLoading(false);
        return;
      }
      setRecoveryCodes(data.recoveryCodes);
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  function handleDone() {
    router.push("/admin");
    router.refresh();
  }

  if (recoveryCodes) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-md">
          <p className="text-center font-display text-2xl">Save your recovery codes</p>
          <p className="mt-2 text-center text-sm text-muted">
            Each code works once, if you lose access to your authenticator app.
            They won&apos;t be shown again.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-5 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            onClick={handleDone}
            className="mt-6 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity"
          >
            I&apos;ve saved these — continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-2xl">Set up two-factor sign-in</p>
        <p className="mt-2 text-center text-sm text-muted">
          Scan this with an authenticator app (e.g. Google Authenticator, 1Password), then
          enter the 6-digit code it shows.
        </p>

        {loadError && <p className="mt-4 text-center text-xs text-danger">{loadError}</p>}

        {qrDataUrl && (
          <div className="mt-6 flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Scan this QR code with your authenticator app"
              className="h-48 w-48 rounded-md border border-border bg-white p-2"
            />
            {secret && (
              <p className="text-center text-xs text-muted">
                Can&apos;t scan it? Enter this key manually:
                <br />
                <span className="font-mono tracking-wider text-foreground">{secret}</span>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleConfirm} className="mt-6 flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-accent transition-colors"
          />
          {error && <p className="text-center text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading || !qrDataUrl}
            className="mt-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? "Confirming…" : "Confirm & enable 2FA"}
          </button>
        </form>
      </div>
    </div>
  );
}
