"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/admin/login") return null;

  async function handleSignOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/admin" className="font-display text-lg tracking-wide">
          Admin
        </Link>
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
