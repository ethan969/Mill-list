"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  // Every pre-authentication step of the login flow (password entry, 2FA
  // QR setup, 2FA code verification) — not just the first page of it. The
  // "Admin" link this header renders otherwise gets prefetched by Next.js
  // while the visitor is still on one of these pages, before any session
  // cookie exists; that prefetch's redirect-to-login result then gets
  // cached client-side and replayed even after a real login succeeds,
  // bouncing the just-authenticated visitor straight back to /admin/login.
  if (pathname.startsWith("/admin/login")) return null;

  async function handleSignOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-display text-lg tracking-wide">
            Admin
          </Link>
          <nav className="flex items-center gap-4 text-xs uppercase tracking-widest">
            <Link
              href="/admin"
              className={
                pathname === "/admin"
                  ? "text-accent"
                  : "text-muted hover:text-accent transition-colors"
              }
            >
              Projects
            </Link>
            <Link
              href="/admin/slates"
              className={
                pathname.startsWith("/admin/slates")
                  ? "text-accent"
                  : "text-muted hover:text-accent transition-colors"
              }
            >
              Slates
            </Link>
            <Link
              href="/admin/fx-rates"
              className={
                pathname.startsWith("/admin/fx-rates")
                  ? "text-accent"
                  : "text-muted hover:text-accent transition-colors"
              }
            >
              FX Rates
            </Link>
          </nav>
        </div>
        <button
          onClick={handleSignOut}
          className="text-[11px] uppercase tracking-widest text-muted hover:text-accent transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
