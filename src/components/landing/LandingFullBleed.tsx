import Image from "next/image";
import PasswordGateForm from "@/components/PasswordGateForm";
import BrandMark from "@/components/landing/BrandMark";
import type { LandingProject } from "@/components/landing/types";

export default function LandingFullBleed({
  project,
}: {
  project: LandingProject;
}) {
  return (
    <div className="relative flex flex-1 flex-col justify-end">
      {project.hasPoster && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={`/api/projects/${project.slug}/poster`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        </div>
      )}

      <div className="flex flex-col items-center px-6 pb-16 pt-40 text-center sm:pb-24">
        <BrandMark project={project} className="animate-fade-up mb-5" />
        <h1 className="animate-fade-up max-w-3xl text-balance font-display text-5xl font-medium leading-tight sm:text-7xl">
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
          className="animate-fade-up mt-12 flex flex-col items-center"
          style={{ animationDelay: "0.15s" }}
        >
          <p className="mb-5 text-xs uppercase tracking-[0.3em] text-muted">
            Private Data Room
          </p>
          <PasswordGateForm slug={project.slug} />
        </div>

        <p className="mt-10 text-[11px] text-muted/60">
          For authorized recipients only. Materials are confidential.
        </p>
      </div>
    </div>
  );
}
