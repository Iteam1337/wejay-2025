import { useNavigate } from "react-router-dom";
import { Track } from "@/types/wejay";
import { useRoom } from "@/contexts/RoomContext";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { LogOut } from "lucide-react";

interface HeaderProps {
  currentTrack: Track | null;
  onTrackEnd: () => void;
  onLogout: () => void;
  onLeaveRoom: () => void;
}

export function Header({
  currentTrack,
  onTrackEnd,
  onLogout,
  onLeaveRoom,
}: HeaderProps) {
  const navigate = useNavigate();
  const { currentRoom, roomUsers, isConnected } = useRoom();

  const handleLogoClick = () => {
    onLeaveRoom();
    navigate("/rooms");
  };

  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container py-3">
        <div className="flex items-center justify-between gap-4">
          <RoomInfo room={currentRoom} userCount={roomUsers.length} isConnected={isConnected} onLogoClick={handleLogoClick} />

          <SpotifyPlayer
            currentTrack={currentTrack}
            onTrackEnd={onTrackEnd}
            playlistId={currentRoom?.spotifyPlaylistId}
            playlistUrl={currentRoom?.spotifyPlaylistUrl}
          />

          <UserControls onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

function RoomInfo({
  room,
  userCount,
  isConnected,
  onLogoClick,
}: {
  room: ReturnType<typeof useRoom>["currentRoom"];
  userCount: number;
  isConnected: boolean;
  onLogoClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <button
          onClick={onLogoClick}
          className="text-lg font-bold uppercase hover:text-primary transition-colors cursor-pointer"
        >
          Wejay
        </button>
        {room && (
          <p className="text-xs text-muted-foreground">
            {room.name} • {userCount} user{userCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
      {isConnected && <div className="w-2 h-2 bg-green-500 rounded-full" />}
    </div>
  );
}

function UserControls({ onLogout }: { onLogout: () => void }) {
  const { myTracks } = useRoom();

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="text-xs text-muted-foreground hidden sm:block uppercase">
        {myTracks.length} {myTracks.length === 1 ? "TRACK" : "TRACKS"}
      </span>
      <UserAvatar />
      <button
        onClick={onLogout}
        className="neumorphic p-2 rounded-lg hover:bg-accent transition-colors"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}

function UserAvatar() {
  const { roomUsers, currentUserId } = useRoom();
  const user = roomUsers.find((u) => u.id === currentUserId);

  return (
    <div className="neumorphic w-8 h-8 rounded-full overflow-hidden">
      <img
        src={user?.images[0]?.url || "/placeholder.svg"}
        alt={user?.display_name || "You"}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
