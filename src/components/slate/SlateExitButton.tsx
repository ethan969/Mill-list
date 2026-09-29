"use client";

import { useRouter } from "next/navigation";

export default function SlateExitButton({ slug }: { slug: string }) {
  const router = useRouter();

  async function handleExit() {
    await fetch(`/api/slate/${slug}/logout`, { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={handleExit}
      className="shrink-0 text-[11px] uppercase tracking-widest text-muted hover:text-accent transition-colors"
    >
      Exit slate
    </button>
  );
}
