import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { TabButton } from "@/components/TabButton";
import { OnlineUsers } from "@/components/OnlineUsers";
import { Playlist } from "@/components/Playlist";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { AIRecommendations } from "@/components/AIRecommendations";
import { SpotifyPlaylistSync } from "@/components/SpotifyPlaylistSync";
import { SearchResults } from "@/components/SearchResults";
import { MyTracks } from "@/components/MyTracks";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { Track, SearchTrack, Room, SpotifyUser, PlaylistEntry } from "@/types/wejay";
import { Heart, Search, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoomManager } from "@/hooks/useRoomManager";
import { usePlaylist } from "@/hooks/usePlaylist";
import { useMusicSearch } from "@/hooks/useMusicSearch";

type Tab = "search" | "favorites";

function useIndexPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentRoom, isConnected, handleLeaveRoom } = useRoomManager();
  const playlist = usePlaylist(currentRoom?.id);
  const musicSearch = useMusicSearch(playlist.myTracks, playlist.myTracksHistory);

  const roomUsers = currentRoom?.users || (user ? [user] : []);

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
    roomUsers,
    handleLogout,
    ...playlist,
    ...musicSearch,
  };
}

const Index = () => {
  const {
    user,
    currentRoom,
    isConnected,
    handleLeaveRoom,
    roomUsers,
    handleLogout,
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

  return (
    <div className="min-h-screen bg-background">
      <Header
        currentRoom={currentRoom}
        roomUsers={roomUsers}
        isConnected={isConnected}
        currentTrack={currentTrack}
        onTrackEnd={handleTrackEnd}
        myTracksCount={myTracks.length}
        user={user}
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

          <CenterColumn
            tracks={arrangedPlaylist}
            users={roomUsers}
            currentUserId={user?.id || "user-1"}
            onMoveTrack={handleMoveTrack}
          />

          <RightSidebar
            roomUsers={roomUsers}
            currentUserId={user?.id || "user-1"}
            currentRoom={currentRoom}
            playlistTracks={playlistTracks}
            aiRecommendations={aiRecommendationsFormatted}
            isLoadingRecommendations={isLoadingRecommendations}
            recommendationsError={recommendationsError}
            onAddTrack={handleAddTrack}
            onRefreshRecommendations={refreshRecommendations}
            addedTrackIds={addedTrackIds}
            myTracks={myTracks}
          />
        </div>
      </main>
    </div>
  );
};

// Sub-components
interface HeaderProps {
  currentRoom: Room | null;
  roomUsers: SpotifyUser[];
  isConnected: boolean;
  currentTrack: Track | null;
  onTrackEnd: () => void;
  myTracksCount: number;
  user: SpotifyUser | null;
  onLogout: () => void;
  onLeaveRoom: () => void;
}

function Header({
  currentRoom,
  roomUsers,
  isConnected,
  currentTrack,
  onTrackEnd,
  myTracksCount,
  user,
  onLogout,
  onLeaveRoom,
}: HeaderProps) {
  const navigate = useNavigate();

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

          <UserControls myTracksCount={myTracksCount} user={user} onLogout={onLogout} />
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
  room: Room | null;
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

function UserControls({
  myTracksCount,
  user,
  onLogout,
}: {
  myTracksCount: number;
  user: SpotifyUser | null;
  onLogout: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="text-xs text-muted-foreground hidden sm:block uppercase">
        {myTracksCount} {myTracksCount === 1 ? "TRACK" : "TRACKS"}
      </span>
      <div className="neumorphic w-8 h-8 rounded-full overflow-hidden">
        <img
          src={user?.images[0]?.url || "/placeholder.svg"}
          alt={user?.display_name || "You"}
          className="w-full h-full object-cover"
        />
      </div>
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

interface LeftSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  searchResults: SearchTrack[];
  isLoading: boolean;
  error: string | null;
  favorites: SearchTrack[];
  isLoadingFavorites: boolean;
  favoritesError: string | null;
  addedTrackIds: Set<string>;
  onAddTrack: (track: SearchTrack) => void;
}

function LeftSidebar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearch,
  searchResults,
  isLoading,
  error,
  favorites,
  isLoadingFavorites,
  favoritesError,
  addedTrackIds,
  onAddTrack,
}: LeftSidebarProps) {
  return (
    <div className="space-y-6 lg:order-1 order-2">
      <SearchBar onSearch={onSearch} />

      <div className="flex gap-3">
        <TabButton active={activeTab === "search"} onClick={() => onTabChange("search")}>
          <span className="flex items-center gap-2 uppercase">
            <Search className="w-4 h-4" />
            SEARCH
          </span>
        </TabButton>
        <TabButton active={activeTab === "favorites"} onClick={() => onTabChange("favorites")}>
          <span className="flex items-center gap-2 uppercase">
            <Heart className="w-4 h-4" />
            FAVORITES
          </span>
        </TabButton>
      </div>

      <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
        <SearchResults
          activeTab={activeTab}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
          searchResults={searchResults}
          favorites={favorites}
          isLoadingFavorites={isLoadingFavorites}
          favoritesError={favoritesError}
          addedTrackIds={addedTrackIds}
          onAddTrack={onAddTrack}
        />
      </div>
    </div>
  );
}

interface CenterColumnProps {
  tracks: PlaylistEntry[];
  users: SpotifyUser[];
  currentUserId: string;
  onMoveTrack: (trackId: string, direction: "up" | "down") => void;
}

function CenterColumn({ tracks, users, currentUserId, onMoveTrack }: CenterColumnProps) {
  return (
    <div className="space-y-6 lg:order-2 order-1">
      <Playlist tracks={tracks} users={users} currentUserId={currentUserId} onMoveTrack={onMoveTrack} />
    </div>
  );
}

interface RightSidebarProps {
  roomUsers: SpotifyUser[];
  currentUserId: string;
  currentRoom: Room | null;
  playlistTracks: Track[];
  aiRecommendations: SearchTrack[];
  isLoadingRecommendations: boolean;
  recommendationsError: string | null;
  onAddTrack: (track: SearchTrack) => void;
  onRefreshRecommendations: () => void;
  addedTrackIds: Set<string>;
  myTracks: PlaylistEntry[];
}

function RightSidebar({
  roomUsers,
  currentUserId,
  currentRoom,
  playlistTracks,
  aiRecommendations,
  isLoadingRecommendations,
  recommendationsError,
  onAddTrack,
  onRefreshRecommendations,
  addedTrackIds,
  myTracks,
}: RightSidebarProps) {
  return (
    <div className="space-y-6 lg:order-3 order-3">
      <OnlineUsers users={roomUsers} currentUserId={currentUserId} />

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

export default Index;
