import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRoomAvailability, firstAvailableSection } from "@/lib/room-availability";
import EmptyState from "@/components/EmptyState";

export default async function RoomIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) notFound();

  const availability = await getRoomAvailability(project.id);
  const first = firstAvailableSection(availability);

  if (first) {
    redirect(`/${slug}/room/${first}`);
  }

  return (
    <EmptyState
      label="This data room"
      message="This data room is still being prepared — check back soon."
    />
  );
}
