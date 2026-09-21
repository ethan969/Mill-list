"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROOM_NAV } from "@/lib/sections";
import type { RoomAvailability } from "@/lib/room-availability";

export default function RoomSidebar({
  slug,
  title,
  logoUrl,
  availability,
}: {
  slug: string;
  title: string;
  logoUrl?: string | null;
  availability: RoomAvailability;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = ROOM_NAV.filter((item) => availability[item.slug]);

  async function handleExit() {
    await fetch(`/api/room/${slug}/logout`, { method: "POST" });
    router.push(`/${slug}`);
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col justify-between border-r border-border px-5 py-6 sm:w-64">
      <div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={title} className="h-8 w-auto object-contain" />
        ) : (
          <p className="font-display text-lg leading-tight tracking-wide">
            {title}
          </p>
        )}
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          {items.length === 0 && (
            <p className="text-xs text-muted">Nothing published yet.</p>
          )}
          {items.map((item) => {
            const href = `/${slug}/room/${item.slug}`;
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={item.slug}
                href={href}
                className={`rounded-md px-3 py-2 transition-colors ${
                  active
                    ? "bg-surface text-foreground"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        onClick={handleExit}
        className="text-left text-[11px] uppercase tracking-widest text-muted hover:text-accent transition-colors"
      >
        Exit room
      </button>
    </aside>
  );
}
