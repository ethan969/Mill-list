import {
  POSTER_WIDTHS,
  POSTER_FORMATS,
  posterVariantHeight,
} from "@/lib/poster-variants";

/**
 * Responsive poster art: AVIF/WebP sources at three widths, falling back to
 * the original upload (via the unchanged plain poster route) for browsers
 * that support neither. Rendered with `display: contents` so it behaves
 * like a plain <img> for its absolutely-positioned parent's h-full/w-full
 * sizing — <picture> itself isn't meant to carry layout.
 */
export default function PosterImage({
  slug,
  sizes,
  className,
}: {
  slug: string;
  sizes: string;
  className?: string;
}) {
  const largest = POSTER_WIDTHS[POSTER_WIDTHS.length - 1]!;

  const srcSet = (format: string) =>
    POSTER_WIDTHS.map(
      (width) => `/api/projects/${slug}/poster?w=${width}&fmt=${format} ${width}w`
    ).join(", ");

  return (
    <picture className="contents">
      {POSTER_FORMATS.map((format) => (
        <source key={format} type={`image/${format}`} srcSet={srcSet(format)} sizes={sizes} />
      ))}
      <img
        src={`/api/projects/${slug}/poster`}
        alt=""
        width={largest}
        height={posterVariantHeight(largest)}
        // This is the LCP candidate on every landing layout — load it
        // immediately rather than waiting for the browser's default
        // (lower) priority for images.
        fetchPriority="high"
        decoding="async"
        className={className}
      />
    </picture>
  );
}
