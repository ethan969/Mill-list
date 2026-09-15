"use client";

import { useState } from "react";

type Item = {
  id: string;
  type: "IMAGE" | "VIDEO";
  caption: string | null;
};

export default function GalleryGrid({ items }: { items: Item[] }) {
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const lightboxItem = items.find((i) => i.id === lightboxId);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setLightboxId(item.id)}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface"
          >
            {item.type === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/gallery/${item.id}/file`}
                alt={item.caption ?? ""}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <video
                src={`/api/gallery/${item.id}/file`}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
            )}
            {item.type === "VIDEO" && (
              <span className="absolute bottom-2 right-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                Video
              </span>
            )}
          </button>
        ))}
      </div>

      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setLightboxId(null)}
        >
          <div
            className="max-h-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxItem.type === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/gallery/${lightboxItem.id}/file`}
                alt={lightboxItem.caption ?? ""}
                className="max-h-[80vh] w-auto rounded-lg"
              />
            ) : (
              <video
                src={`/api/gallery/${lightboxItem.id}/file`}
                className="max-h-[80vh] w-auto rounded-lg"
                controls
                autoPlay
              />
            )}
            {lightboxItem.caption && (
              <p className="mt-3 text-center text-xs text-muted">
                {lightboxItem.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
