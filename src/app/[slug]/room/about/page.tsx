import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRoomAvailability, firstAvailableSection } from "@/lib/room-availability";
import EmptyState from "@/components/EmptyState";

type TeamMember = { name: string; role?: string; bio?: string };

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      productionCompany: true,
      aboutContent: true,
      aboutTeam: true,
    },
  });
  if (!project) notFound();

  const team = Array.isArray(project.aboutTeam)
    ? (project.aboutTeam as unknown as TeamMember[])
    : [];

  if (!project.aboutContent && team.length === 0) {
    const fallback = firstAvailableSection(await getRoomAvailability(project.id));
    if (fallback) redirect(`/${slug}/room/${fallback}`);
    return <EmptyState label="An about page" />;
  }

  const paragraphs = (project.aboutContent || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="font-display text-2xl">{project.productionCompany}</h2>
        <div className="mt-4 flex max-w-2xl flex-col gap-4 text-sm leading-relaxed text-foreground/90">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      {team.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-[0.25em] text-muted">
            Team
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <p className="font-medium">{member.name}</p>
                {member.role && (
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-accent">
                    {member.role}
                  </p>
                )}
                {member.bio && (
                  <p className="mt-3 text-sm text-muted">{member.bio}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
