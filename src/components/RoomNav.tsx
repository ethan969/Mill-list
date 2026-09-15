"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROOM_NAV } from "@/lib/sections";

export default function RoomNav({
  slug,
  title,
  logoUrl,
}: {
  slug: string;
  title: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleExit() {
    await fetch(`/api/room/${slug}/logout`, { method: "POST" });
    router.push(`/${slug}`);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={title} className="h-7 w-auto object-contain" />
          ) : (
            <p className="font-display text-lg tracking-wide">{title}</p>
          )}
          <button
            onClick={handleExit}
            className="text-[11px] uppercase tracking-widest text-muted hover:text-accent transition-colors"
          >
            Exit room
          </button>
        </div>
        <nav className="-mb-4 flex gap-5 overflow-x-auto pb-4 text-sm">
          {ROOM_NAV.map((item) => {
            const href = `/${slug}/room/${item.slug}`;
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={item.slug}
                href={href}
                className={`whitespace-nowrap border-b-2 pb-1 transition-colors ${
                  active
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
