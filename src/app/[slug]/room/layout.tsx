import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRoomSession } from "@/lib/auth";
import { getRoomAvailability } from "@/lib/room-availability";
import RoomNav from "@/components/RoomNav";
import RoomSidebar from "@/components/RoomSidebar";
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
      fontId: true,
      roomLayout: true,
      logoKey: true,
    },
  });

  if (!project || !project.isPublished) notFound();

  const session = await getRoomSession(slug);
  if (!session || session.projectId !== project.id) {
    redirect(`/${slug}`);
  }

  const logoUrl = project.logoKey ? `/api/projects/${slug}/logo` : null;
  const availability = await getRoomAvailability(project.id);

  if (project.roomLayout === "sidebar") {
    return (
      <ThemeWrapper
        themeId={project.themeId}
        accentColor={project.accentColor}
        fontId={project.fontId}
        className="flex flex-1"
      >
        <RoomSidebar
          slug={slug}
          title={project.title}
          logoUrl={logoUrl}
          availability={availability}
        />
        <main className="w-full max-w-4xl flex-1 px-5 py-10 sm:px-10">
          {children}
        </main>
      </ThemeWrapper>
    );
  }

  return (
    <ThemeWrapper
      themeId={project.themeId}
      accentColor={project.accentColor}
      fontId={project.fontId}
      className="flex flex-1 flex-col"
    >
      <RoomNav
        slug={slug}
        title={project.title}
        logoUrl={logoUrl}
        availability={availability}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        {children}
      </main>
    </ThemeWrapper>
  );
}
