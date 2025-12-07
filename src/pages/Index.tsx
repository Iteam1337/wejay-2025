import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { TrackCard } from "@/components/TrackCard";
import { TabButton } from "@/components/TabButton";
import { OnlineUsers } from "@/components/OnlineUsers";
import { Playlist } from "@/components/Playlist";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { mockUsers, mockFavorites, mockPlaylistTracks } from "@/lib/mockData";
import { arrangeTracks } from "@/lib/dhondt";
import { Track, SearchTrack } from "@/types/wejay";
import { toast } from "sonner";
import { Heart, Search, Loader2, LogOut } from "lucide-react";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";

type Tab = "search" | "favorites";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, logout } = useAuth();
  const { 
    isConnected, 
    currentRoom, 
    users: socketUsers, 
    joinRoom, 
    leaveRoom,
    addTrack: socketAddTrack 
  } = useSocket();
  
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>(mockPlaylistTracks);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState(mockUsers);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentUserId = user?.id || "user-1";

  const { results: spotifyResults, isLoading, error } = useSpotifySearch(
    searchQuery,
    activeTab === "search"
  );

  // Handle authentication and room joining
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/');
      return;
    }

    const roomId = searchParams.get('room');
    if (roomId && isConnected) {
      joinRoom(roomId);
    }

    return () => {
      if (currentRoom) {
        leaveRoom();
      }
    };
  }, [isAuthenticated, user, navigate, searchParams, isConnected, joinRoom, leaveRoom, currentRoom]);

  // Update users when socket users change
  useEffect(() => {
    if (socketUsers.length > 0) {
      setUsers(socketUsers.map(u => ({
        id: u.id,
        name: u.display_name,
        avatar: u.images[0]?.url || '/placeholder.svg',
        isOnline: true,
        tracksAdded: 0, // This would be tracked by the backend
      })));
    }
  }, [socketUsers]);

  const searchResults: SearchTrack[] = useMemo(() => {
    return spotifyResults.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || "/placeholder.svg",
      duration: Math.floor(track.duration_ms / 1000),
    }));
  }, [spotifyResults]);

  const arrangedPlaylist = useMemo(() => {
    return arrangeTracks(playlistTracks);
  }, [playlistTracks]);

  const currentTrack = arrangedPlaylist[0] || null;

  const handleTrackEnd = useCallback(() => {
    if (arrangedPlaylist.length > 0) {
      // Remove the first track (just finished playing)
      setPlaylistTracks(prev => {
        const firstTrackId = arrangedPlaylist[0]?.id;
        return prev.filter(t => t.id !== firstTrackId);
      });
      toast.success("NEXT TRACK", {
        description: arrangedPlaylist[1]?.name || "Queue is empty",
      });
    }
  }, [arrangedPlaylist]);

  const handleSkip = useCallback(() => {
    if (arrangedPlaylist.length > 0) {
      handleTrackEnd();
    }
  }, [handleTrackEnd, arrangedPlaylist]);

  const handlePlayPause = useCallback(() => {
    if (arrangedPlaylist.length === 0) {
      toast.error("QUEUE IS EMPTY", {
        description: "Add tracks to start playing",
      });
      return;
    }
    setIsPlaying(prev => !prev);
  }, [arrangedPlaylist]);

  const handleAddTrack = (track: SearchTrack) => {
    const newTrack: Track = {
      ...track,
      id: `${track.id}-${Date.now()}`,
      addedBy: currentUserId,
      addedAt: new Date(),
    };

    setPlaylistTracks(prev => [...prev, newTrack]);
    setAddedTrackIds(prev => new Set([...prev, track.id]));
    
    // Update user's track count
    setUsers(prev => prev.map(u => 
      u.id === currentUserId 
        ? { ...u, tracksAdded: u.tracksAdded + 1 }
        : u
    ));

    // Send to socket if connected
    if (isConnected && currentRoom) {
      socketAddTrack(newTrack);
    }

    toast.success(`${track.name} added to queue`, {
      description: currentRoom ? "Added to room queue" : "Track arranged using D'Hondt method",
    });
  };

  const myTracks = arrangedPlaylist.filter(t => t.addedBy === currentUserId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Player */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Room Info */}
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold uppercase">Wejay</h1>
                {currentRoom && (
                  <p className="text-xs text-muted-foreground">
                    {currentRoom.name} • {users.length} user{users.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {isConnected && (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              )}
            </div>

            <SpotifyPlayer
              currentTrack={currentTrack}
              onTrackEnd={handleTrackEnd}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSkip={handleSkip}
            />
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:block uppercase">
                {myTracks.length} {myTracks.length === 1 ? "TRACK" : "TRACKS"}
              </span>
              <div className="neumorphic w-8 h-8 rounded-full overflow-hidden">
                <img 
                  src={user?.images[0]?.url || mockUsers[0].avatar} 
                  alt={user?.display_name || "You"}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => {
                  leaveRoom();
                  logout();
                  navigate('/');
                }}
                className="neumorphic p-2 rounded-lg hover:bg-accent transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="grid lg:grid-cols-[1fr,340px] gap-6">
          {/* Left Column - Search & Add */}
          <div className="space-y-6">
            {/* Search */}
            <SearchBar onSearch={setSearchQuery} />

            {/* Tabs */}
            <div className="flex gap-3">
              <TabButton 
                active={activeTab === "search"} 
                onClick={() => setActiveTab("search")}
              >
                <span className="flex items-center gap-2 uppercase">
                  <Search className="w-4 h-4" />
                  SEARCH
                </span>
              </TabButton>
              <TabButton 
                active={activeTab === "favorites"} 
                onClick={() => setActiveTab("favorites")}
              >
                <span className="flex items-center gap-2 uppercase">
                  <Heart className="w-4 h-4" />
                  FAVORITES
                </span>
              </TabButton>
            </div>

            {/* Track List */}
            <div className="space-y-3">
              {activeTab === "search" ? (
                isLoading ? (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-50" />
                    <p className="uppercase">SEARCHING SPOTIFY...</p>
                  </div>
                ) : error ? (
                  <div className="neumorphic p-8 text-center text-destructive">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{error}</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(track => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      onAdd={handleAddTrack}
                      isAdded={addedTrackIds.has(track.id)}
                    />
                  ))
                ) : searchQuery.trim() ? (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="uppercase">NO RESULTS FOR "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="uppercase">SEARCH FOR TRACKS ON SPOTIFY</p>
                  </div>
                )
              ) : (
                mockFavorites.map(track => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onAdd={handleAddTrack}
                    isAdded={addedTrackIds.has(track.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Column - Queue & Users */}
          <div className="space-y-6">
            {/* Online Users - Show on mobile as horizontal scroll */}
            <div className="lg:block">
              <OnlineUsers users={users} currentUserId={currentUserId} />
            </div>

            {/* My Contributions */}
            {myTracks.length > 0 && (
              <div className="neumorphic p-4">
                <h3 className="font-medium text-sm mb-3 flex items-center gap-2 uppercase">
                  <span className="text-primary">YOUR TRACKS</span>
                  <span className="text-muted-foreground">({myTracks.length})</span>
                </h3>
                <div className="space-y-2">
                  {myTracks.slice(0, 3).map(track => (
                    <div key={track.id} className="flex items-center gap-2 text-sm">
                      <img 
                        src={track.albumArt} 
                        alt={track.album}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground">{track.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">#{track.position}</span>
                    </div>
                  ))}
                    {myTracks.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center pt-1 uppercase">
                        +{myTracks.length - 3} MORE
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Playlist Queue */}
            <Playlist 
              tracks={arrangedPlaylist} 
              users={users} 
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
