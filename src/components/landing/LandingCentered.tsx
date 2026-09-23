import Image from "next/image";
import PasswordGateForm from "@/components/PasswordGateForm";
import BrandMark from "@/components/landing/BrandMark";
import type { LandingProject } from "@/components/landing/types";

export default function LandingCentered({
  project,
}: {
  project: LandingProject;
}) {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      {project.hasPoster && (
        <div className="absolute inset-0 -z-20 overflow-hidden">
          <Image
            src={`/api/projects/${project.slug}/poster`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="animate-kenburns scale-110 object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-background/55 to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/45" />
        </div>
      )}
      <div aria-hidden className="grain-overlay -z-10" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <BrandMark project={project} className="animate-fade-up mb-7" />
        <div
          className="animate-fade-up h-px w-10 bg-accent/70"
          style={{ animationDelay: "0.05s" }}
        />
        <h1
          className={`animate-fade-up mt-7 max-w-4xl text-balance font-display text-6xl font-medium leading-[0.95] tracking-tight sm:text-8xl ${
            project.hasPoster ? "text-shadow-hero" : ""
          }`}
        >
          {project.title}
        </h1>
        {project.tagline && (
          <p
            className={`animate-fade-up mt-7 max-w-xl text-balance text-base text-muted sm:text-lg ${
              project.hasPoster ? "text-shadow-hero" : ""
            }`}
            style={{ animationDelay: "0.1s" }}
          >
            {project.tagline}
          </p>
        )}

        <div
          className="animate-fade-up mt-16 flex flex-col items-center rounded-xl border border-border/60 bg-surface/50 px-8 py-7 backdrop-blur-sm"
          style={{ animationDelay: "0.18s" }}
        >
          <p className="mb-5 text-[11px] uppercase tracking-[0.35em] text-muted">
            Private Data Room
          </p>
          <PasswordGateForm slug={project.slug} />
        </div>
      </div>

      <footer className="relative border-t border-border/30 pb-8 pt-6 text-center text-[11px] tracking-wide text-muted/70">
        For authorized recipients only. Materials are confidential.
      </footer>
    </div>
  );
}
