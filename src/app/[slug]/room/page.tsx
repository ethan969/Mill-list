import { redirect } from "next/navigation";
import { getRoomAvailability, firstAvailableSection } from "@/lib/room-availability";
import { requireRoomAccess } from "@/lib/require-room-access";
import EmptyState from "@/components/EmptyState";

export default async function RoomIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { projectId } = await requireRoomAccess(slug);

  const availability = await getRoomAvailability(projectId);
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
