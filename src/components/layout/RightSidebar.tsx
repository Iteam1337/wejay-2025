import { useRoom } from "@/contexts/RoomContext";
import { OnlineUsers } from "@/components/OnlineUsers";
import { SpotifyPlaylistSync } from "@/components/SpotifyPlaylistSync";
import { AIRecommendations } from "@/components/AIRecommendations";
import { MyTracks } from "@/components/MyTracks";
import { SearchTrack } from "@/types/wejay";

interface RightSidebarProps {
  aiRecommendations: SearchTrack[];
  isLoadingRecommendations: boolean;
  recommendationsError: string | null;
  onAddTrack: (track: SearchTrack) => void;
  onRefreshRecommendations: () => void;
  addedTrackIds: Set<string>;
}

export function RightSidebar({
  aiRecommendations,
  isLoadingRecommendations,
  recommendationsError,
  onAddTrack,
  onRefreshRecommendations,
  addedTrackIds,
}: RightSidebarProps) {
  const { currentRoom, playlistTracks, myTracks } = useRoom();

  return (
    <div className="space-y-6 lg:order-3 order-3">
      <OnlineUsers />

      {currentRoom && (
        <SpotifyPlaylistSync
          playlistUrl={currentRoom.spotifyPlaylistUrl}
          hasTracksInQueue={playlistTracks.length > 0}
          room={currentRoom}
        />
      )}

      <AIRecommendations
        recommendations={aiRecommendations}
        isLoading={isLoadingRecommendations}
        error={recommendationsError}
        onAdd={onAddTrack}
        onRefresh={onRefreshRecommendations}
        addedTrackIds={addedTrackIds}
        hasMyTracks={myTracks.length > 0}
      />

      <MyTracks tracks={myTracks} />
    </div>
  );
}
