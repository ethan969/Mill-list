"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function FlickBook({
  fileUrl,
  onLoaded,
}: {
  fileUrl: string;
  onLoaded?: (pageCount: number) => void;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWidth, setPageWidth] = useState<number>(720);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setPageWidth(Math.min(820, containerRef.current.clientWidth));
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const goPrev = useCallback(
    () => setPageNumber((p) => Math.max(1, p - 1)),
    []
  );
  const goNext = useCallback(
    () => setPageNumber((p) => Math.min(numPages ?? p, p + 1)),
    [numPages]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]!.clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0]!.clientX - touchStartX.current;
    if (delta > 60) goPrev();
    if (delta < -60) goNext();
    touchStartX.current = null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex min-h-[400px] items-center justify-center rounded-lg border border-border bg-surface p-4 sm:p-8"
      >
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              onLoaded?.(n);
            }}
            onLoadError={() => setError("Couldn't load this document.")}
            loading={
              <p className="text-sm text-muted">Loading document…</p>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={<p className="text-sm text-muted">Loading page…</p>}
            />
          </Document>
        )}

        {numPages && numPages > 1 && (
          <>
            <button
              aria-label="Previous page"
              onClick={goPrev}
              disabled={pageNumber <= 1}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-lg leading-none text-foreground shadow disabled:opacity-30 hover:bg-background"
            >
              ‹
            </button>
            <button
              aria-label="Next page"
              onClick={goNext}
              disabled={pageNumber >= numPages}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-lg leading-none text-foreground shadow disabled:opacity-30 hover:bg-background"
            >
              ›
            </button>
          </>
        )}
      </div>

      {numPages && numPages > 1 && (
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={numPages}
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value))}
            className="h-1 flex-1 accent-accent"
          />
          <span className="whitespace-nowrap text-xs text-muted">
            Page {pageNumber} / {numPages}
          </span>
        </div>
      )}
    </div>
  );
}
