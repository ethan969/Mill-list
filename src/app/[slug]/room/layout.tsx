import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRoomSession } from "@/lib/auth";
import RoomNav from "@/components/RoomNav";
import ThemeWrapper from "@/components/ThemeWrapper";

export default async function RoomLayout({
  params,
  children,
}: LayoutProps<"/[slug]/room">) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      isPublished: true,
      themeId: true,
      accentColor: true,
      logoKey: true,
    },
  });

  if (!project || !project.isPublished) notFound();

  const session = await getRoomSession(slug);
  if (!session || session.projectId !== project.id) {
    redirect(`/${slug}`);
  }

  return (
    <ThemeWrapper
      themeId={project.themeId}
      accentColor={project.accentColor}
      className="flex flex-1 flex-col"
    >
      <RoomNav
        slug={slug}
        title={project.title}
        logoUrl={project.logoKey ? `/api/projects/${slug}/logo` : null}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        {children}
      </main>
    </ThemeWrapper>
  );
}
