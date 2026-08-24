import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRoomManager } from "@/hooks/useRoomManager";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useMusicSearch } from "@/hooks/useMusicSearch";
import { RoomProvider } from "@/contexts/RoomContext";
import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { CenterColumn } from "@/components/layout/CenterColumn";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { OnboardingBanner } from "@/components/OnboardingBanner";

function useIndexPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentRoom, isConnected, handleLeaveRoom } = useRoomManager();
  const playlist = usePlaylist(currentRoom?.id);
  const musicSearch = useMusicSearch(playlist.myTracks, playlist.myTracksHistory);

  const roomUsers = currentRoom?.users || (user ? [user] : []);
  const currentUserId = user?.id || "user-1";

  const handleLogout = useCallback(() => {
    handleLeaveRoom();
    logout();
    navigate("/");
  }, [handleLeaveRoom, logout, navigate]);

  return {
    user,
    currentRoom,
    isConnected,
    handleLeaveRoom,
    handleLogout,
    currentUserId,
    roomUsers,
    ...playlist,
    ...musicSearch,
  };
}

const Index = () => {
  const {
    currentRoom,
    isConnected,
    handleLeaveRoom,
    handleLogout,
    currentUserId,
    roomUsers,
    playlistTracks,
    arrangedPlaylist,
    currentTrack,
    myTracks,
    addedTrackIds,
    handleTrackEnd,
    handleAddTrack,
    handleMoveTrack,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading,
    error,
    favoritesFormatted,
    isLoadingFavorites,
    favoritesError,
    aiRecommendationsFormatted,
    isLoadingRecommendations,
    recommendationsError,
    refreshRecommendations,
  } = useIndexPage();

  const roomContextValue = {
    currentRoom,
    roomUsers,
    currentUserId,
    isConnected,
    playlistTracks,
    arrangedPlaylist,
    myTracks,
  };

  return (
    <RoomProvider value={roomContextValue}>
      <div className="min-h-screen bg-background">
        <Header
          currentTrack={currentTrack}
          onTrackEnd={handleTrackEnd}
          onLogout={handleLogout}
          onLeaveRoom={handleLeaveRoom}
        />

        <main className="container py-6">
          {currentRoom && <OnboardingBanner room={currentRoom} show={arrangedPlaylist.length === 0} />}

          <div className="grid lg:grid-cols-[320px,1fr,340px] gap-6">
            <LeftSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              searchResults={searchResults}
              isLoading={isLoading}
              error={error}
              favorites={favoritesFormatted}
              isLoadingFavorites={isLoadingFavorites}
              favoritesError={favoritesError}
              addedTrackIds={addedTrackIds}
              onAddTrack={handleAddTrack}
            />

            <CenterColumn onMoveTrack={handleMoveTrack} />

            <RightSidebar
              aiRecommendations={aiRecommendationsFormatted}
              isLoadingRecommendations={isLoadingRecommendations}
              recommendationsError={recommendationsError}
              onAddTrack={handleAddTrack}
              onRefreshRecommendations={refreshRecommendations}
              addedTrackIds={addedTrackIds}
            />
          </div>
        </main>
      </div>
    </RoomProvider>
  );
};

export default Index;
