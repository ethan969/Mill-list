import Link from "next/link";
import PosterImage from "@/components/landing/PosterImage";

export type SlateFilm = {
  slug: string;
  title: string;
  productionCompany: string;
  tagline: string | null;
  hasPoster: boolean;
};

export default function SlateFilmCard({
  slateSlug,
  film,
}: {
  slateSlug: string;
  film: SlateFilm;
}) {
  return (
    <Link
      href={`/slate/${slateSlug}/${film.slug}`}
      className="group relative flex aspect-[2/3] flex-col justify-end overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-accent"
    >
      {film.hasPoster && (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <PosterImage
            slug={film.slug}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
      )}
      <div className="relative flex flex-col gap-1 p-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
          {film.productionCompany}
        </p>
        <h3 className="font-display text-2xl leading-tight">{film.title}</h3>
        {film.tagline && (
          <p className="mt-1 line-clamp-2 text-xs text-muted">{film.tagline}</p>
        )}
        <span className="mt-3 text-[11px] uppercase tracking-[0.2em] text-accent opacity-0 transition-opacity group-hover:opacity-100">
          View film →
        </span>
      </div>
    </Link>
  );
}
