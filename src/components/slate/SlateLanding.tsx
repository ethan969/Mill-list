import PasswordGateForm from "@/components/PasswordGateForm";

export default function SlateLanding({
  slug,
  title,
  overview,
}: {
  slug: string;
  title: string;
  overview: string | null;
}) {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="grain-overlay -z-10" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="animate-fade-up text-sm tracking-[0.35em] text-muted uppercase">
          Curated Slate
        </p>
        <div
          className="animate-fade-up mt-7 h-px w-10 bg-accent/70"
          style={{ animationDelay: "0.05s" }}
        />
        <h1
          className="animate-fade-up mt-7 max-w-4xl text-balance font-display text-6xl font-medium leading-[0.95] tracking-tight sm:text-8xl"
          style={{ animationDelay: "0.08s" }}
        >
          {title}
        </h1>
        {overview && (
          <p
            className="animate-fade-up mt-7 max-w-prose text-balance text-base text-muted sm:text-lg"
            style={{ animationDelay: "0.1s" }}
          >
            {overview}
          </p>
        )}

        <div
          className="animate-fade-up mt-16 flex flex-col items-center rounded-xl border border-border/60 bg-surface/50 px-8 py-7 backdrop-blur-sm"
          style={{ animationDelay: "0.18s" }}
        >
          <p className="mb-5 text-[11px] uppercase tracking-[0.35em] text-muted">
            Private Slate
          </p>
          <PasswordGateForm
            slug={slug}
            authPath={`/api/slate/${slug}/auth`}
            redirectPath={`/slate/${slug}`}
          />
        </div>
      </div>

      <footer className="relative border-t border-border/30 pb-8 pt-6 text-center text-[11px] tracking-wide text-muted/70">
        For authorized recipients only. Materials are confidential.
      </footer>
    </div>
  );
}
