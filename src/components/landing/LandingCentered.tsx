import PasswordGateForm from "@/components/PasswordGateForm";
import BrandMark from "@/components/landing/BrandMark";
import type { LandingProject } from "@/components/landing/types";

export default function LandingCentered({
  project,
}: {
  project: LandingProject;
}) {
  return (
    <div className="relative flex flex-1 flex-col">
      {project.hasPoster && (
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/projects/${project.slug}/poster`}
            alt=""
            className="h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <BrandMark project={project} className="animate-fade-up mb-6" />
        <h1 className="animate-fade-up mt-5 max-w-3xl text-balance font-display text-5xl font-medium leading-tight sm:text-7xl">
          {project.title}
        </h1>
        {project.tagline && (
          <p
            className="animate-fade-up mt-6 max-w-xl text-balance text-base text-muted"
            style={{ animationDelay: "0.1s" }}
          >
            {project.tagline}
          </p>
        )}

        <div
          className="animate-fade-up mt-14 flex flex-col items-center"
          style={{ animationDelay: "0.15s" }}
        >
          <p className="mb-5 text-xs uppercase tracking-[0.3em] text-muted">
            Private Data Room
          </p>
          <PasswordGateForm slug={project.slug} />
        </div>
      </div>

      <footer className="pb-8 text-center text-[11px] text-muted/60">
        For authorized recipients only. Materials are confidential.
      </footer>
    </div>
  );
}
