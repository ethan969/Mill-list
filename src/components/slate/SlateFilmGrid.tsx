import SlateFilmCard, { type SlateFilm } from "@/components/slate/SlateFilmCard";
import SlateExitButton from "@/components/slate/SlateExitButton";

export default function SlateFilmGrid({
  slug,
  title,
  overview,
  films,
}: {
  slug: string;
  title: string;
  overview: string | null;
  films: SlateFilm[];
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
                Curated Slate
              </p>
              <h1 className="mt-2 font-display text-4xl">{title}</h1>
            </div>
            <SlateExitButton slug={slug} />
          </div>
          {overview && (
            <p className="max-w-2xl text-sm text-muted">{overview}</p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        {films.length === 0 ? (
          <p className="text-sm text-muted">
            This slate doesn&apos;t have any films available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {films.map((film) => (
              <SlateFilmCard key={film.slug} film={film} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
