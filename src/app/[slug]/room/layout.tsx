import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRoomSession } from "@/lib/auth";
import RoomNav from "@/components/RoomNav";

export default async function RoomLayout({
  params,
  children,
}: LayoutProps<"/[slug]/room">) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, isPublished: true, accentColor: true },
  });

  if (!project || !project.isPublished) notFound();

  const session = await getRoomSession(slug);
  if (!session || session.projectId !== project.id) {
    redirect(`/${slug}`);
  }

  return (
    <div
      className="flex flex-1 flex-col"
      style={{ "--color-accent": project.accentColor } as React.CSSProperties}
    >
      <RoomNav slug={slug} title={project.title} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
