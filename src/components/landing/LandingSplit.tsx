import PasswordGateForm from "@/components/PasswordGateForm";
import BrandMark from "@/components/landing/BrandMark";
import type { LandingProject } from "@/components/landing/types";

export default function LandingSplit({
  project,
}: {
  project: LandingProject;
}) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <div className="relative h-64 w-full shrink-0 overflow-hidden bg-surface md:h-auto md:w-1/2">
        {project.hasPoster ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/projects/${project.slug}/poster`}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent md:bg-gradient-to-r" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <p className="font-display text-3xl text-muted">
              {project.title}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-start justify-center px-8 py-16 text-left sm:px-14 md:py-24">
        <BrandMark project={project} className="animate-fade-up mb-6" />
        <h1 className="animate-fade-up text-balance font-display text-4xl font-medium leading-tight sm:text-6xl">
          {project.title}
        </h1>
        {project.tagline && (
          <p
            className="animate-fade-up mt-6 max-w-md text-balance text-base text-muted"
            style={{ animationDelay: "0.1s" }}
          >
            {project.tagline}
          </p>
        )}

        <div
          className="animate-fade-up mt-14 flex flex-col items-start"
          style={{ animationDelay: "0.15s" }}
        >
          <p className="mb-5 text-xs uppercase tracking-[0.3em] text-muted">
            Private Data Room
          </p>
          <PasswordGateForm slug={project.slug} />
        </div>

        <p className="mt-16 text-[11px] text-muted/60">
          For authorized recipients only. Materials are confidential.
        </p>
      </div>
    </div>
  );
}
