import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRoomAvailability, firstAvailableSection } from "@/lib/room-availability";
import { requireRoomAccess } from "@/lib/require-room-access";
import GalleryGrid from "@/components/GalleryGrid";
import EmptyState from "@/components/EmptyState";

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireRoomAccess(slug);

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) notFound();

  const [gallery, references] = await Promise.all([
    prisma.galleryItem.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
      select: { id: true, type: true, caption: true },
    }),
    prisma.referenceLink.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
    }),
  ]);

  if (gallery.length === 0 && references.length === 0) {
    const fallback = firstAvailableSection(await getRoomAvailability(project.id));
    if (fallback) redirect(`/${slug}/room/${fallback}`);
    return <EmptyState label="Gallery & references" />;
  }

  return (
    <div className="flex flex-col gap-10">
      {gallery.length > 0 && (
        <div>
          <h2 className="font-display text-2xl">Gallery</h2>
          <div className="mt-4">
            <GalleryGrid items={gallery} />
          </div>
        </div>
      )}

      {references.length > 0 && (
        <div>
          <h2 className="font-display text-2xl">References</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {references.map((ref) => (
              <li key={ref.id}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground/90 underline decoration-border underline-offset-4 hover:text-accent hover:decoration-accent transition-colors"
                >
                  {ref.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
