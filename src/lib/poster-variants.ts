import "server-only";

/** Widths (px) generated for the responsive poster <picture>. */
export const POSTER_WIDTHS = [800, 1600, 2400] as const;

/** Formats generated alongside the original upload. */
export const POSTER_FORMATS = ["avif", "webp"] as const;
export type PosterFormat = (typeof POSTER_FORMATS)[number];

/**
 * Posters are cropped to a fixed 2:3 portrait ratio when generating
 * variants, so every variant's dimensions are known up front (800x1200,
 * 1600x2400, 2400x3600) without needing to store per-project width/height —
 * keeping this feature schema-free. The <picture>'s <img> still renders via
 * `object-cover` at whatever size its container actually is; this ratio
 * only decides how each stored variant is pre-cropped.
 */
export const POSTER_ASPECT_RATIO = 2 / 3; // width / height

export function posterVariantHeight(width: number): number {
  return Math.round(width / POSTER_ASPECT_RATIO);
}

export function isPosterWidth(value: number): value is (typeof POSTER_WIDTHS)[number] {
  return (POSTER_WIDTHS as readonly number[]).includes(value);
}

export function isPosterFormat(value: string): value is PosterFormat {
  return (POSTER_FORMATS as readonly string[]).includes(value);
}

/** Deterministic storage key for a poster variant — no DB column needed. */
export function posterVariantKey(
  projectId: string,
  width: number,
  format: PosterFormat
): string {
  return `projects/${projectId}/poster/poster-${width}.${format}`;
}
