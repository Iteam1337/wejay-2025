import { useRoom } from "@/contexts/RoomContext";
import { Playlist } from "@/components/Playlist";

interface CenterColumnProps {
  onMoveTrack: (trackId: string, direction: "up" | "down") => void;
}

export function CenterColumn({ onMoveTrack }: CenterColumnProps) {
  const { arrangedPlaylist, roomUsers, currentUserId } = useRoom();

  return (
    <div className="space-y-6 lg:order-2 order-1">
      <Playlist tracks={arrangedPlaylist} users={roomUsers} currentUserId={currentUserId} onMoveTrack={onMoveTrack} />
    </div>
  );
}
