import type { LandingProject } from "@/components/landing/types";

export default function BrandMark({
  project,
  className,
}: {
  project: LandingProject;
  className?: string;
}) {
  if (project.hasLogo) {
    return (
      <div className={`h-14 ${className ?? ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/projects/${project.slug}/logo`}
          alt={project.productionCompany}
          className="h-full w-auto object-contain"
        />
      </div>
    );
  }
  return (
    <p
      className={`font-display text-sm tracking-[0.35em] text-muted uppercase ${className ?? ""}`}
    >
      {project.productionCompany}
    </p>
  );
}
