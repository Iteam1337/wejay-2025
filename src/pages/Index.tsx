import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { SearchBar } from "@/components/SearchBar";
import { TrackCard } from "@/components/TrackCard";
import { TabButton } from "@/components/TabButton";
import { OnlineUsers } from "@/components/OnlineUsers";
import { Playlist } from "@/components/Playlist";
import { SpotifyPlayer } from "@/components/SpotifyPlayer";
import { AIRecommendations } from "@/components/AIRecommendations";
import { SpotifyPlaylistSync } from "@/components/SpotifyPlaylistSync";
import { arrangeTracks } from "@/lib/dhondt";
import { Track, SearchTrack } from "@/types/wejay";
import { toast } from '@/lib/toast';
import { Heart, Search, Loader2, LogOut } from "lucide-react";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import { useSpotifyRecommendations } from "@/hooks/useSpotifyRecommendations";
import { useSpotifyFavorites } from "@/hooks/useSpotifyFavorites";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";

type Tab = "search" | "favorites";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const { user, isAuthenticated, logout } = useAuth();
  const { 
    isConnected, 
    currentRoom, 
    tracks: socketTracks,
    playbackState: socketPlaybackState,
    joinRoom, 
    leaveRoom,
    addTrack: socketAddTrack,
    trackEnded,
    moveTrack: socketMoveTrack
  } = useSocket();
  
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());
  const [myTracksHistory, setMyTracksHistory] = useState<Track[]>([]); // Keep history of all tracks I've added

  const currentUserId = user?.id || "user-1";
  // Use room users from socket if available, otherwise just show current user
  const roomUsers = currentRoom?.users || (user ? [user] : []);

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

    // Support both URL params (/room/:id) and query params (?room=id)
    const roomId = urlRoomId || searchParams.get('room');
    if (!roomId) return;

    // Skip if already in this room
    if (currentRoom?.id === roomId) return;

    const loadAndJoinRoom = async () => {
      try {
        // Load room from server
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
          toast.error('Room not found', {
            description: 'This room may have been deleted or is invalid.',
          });
          navigate('/rooms');
          return;
        }

        const roomData = await response.json();
        
        // Join room via API
        await fetch(`/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        });

        // Join room via socket
        if (isConnected) {
          joinRoom(roomId);
        }

        toast.success(`Joined ${roomData.name}`, {
          description: 'You can now share music with others!',
        });
      } catch (error) {
        console.error('Failed to join room:', error);
        toast.error('Failed to join room');
        navigate('/rooms');
      }
    };

    loadAndJoinRoom();
  }, [isAuthenticated, user, navigate, urlRoomId, searchParams, isConnected, joinRoom, currentRoom]);

  // Cleanup when leaving
  useEffect(() => {
    return () => {
      if (currentRoom && user) {
        // Leave room via API when unmounting
        fetch(`/api/rooms/${currentRoom.id}/leave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        }).catch(console.error);

        leaveRoom();
      }
    };
  }, [currentRoom, user, leaveRoom]);

  // Use socket tracks instead of local state
  useEffect(() => {
    setPlaylistTracks(socketTracks);
  }, [socketTracks]);

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
    console.log('[handleTrackEnd] Called, playlist length:', arrangedPlaylist.length);
    console.log('[handleTrackEnd] isConnected:', isConnected, 'currentRoom:', currentRoom?.id);
    
    if (arrangedPlaylist.length > 0) {
      const finishedTrack = arrangedPlaylist[0];
      console.log('[handleTrackEnd] Finished track:', finishedTrack?.name, finishedTrack?.id);
      console.log('[handleTrackEnd] Next track:', arrangedPlaylist[1]?.name, arrangedPlaylist[1]?.id);
      
      // Send trackEnded event to server via socket
      // This will update Redis and broadcast to all users
      if (isConnected && currentRoom) {
        console.log('[handleTrackEnd] Sending trackEnded socket event to room:', currentRoom.id);
        trackEnded();
      } else {
        console.log('[handleTrackEnd] Not connected - updating local state only');
        // Fallback: update local state if not connected
        setPlaylistTracks(prev => {
          const firstTrackId = arrangedPlaylist[0]?.id;
          const filtered = prev.filter(t => t.id !== firstTrackId);
          console.log('[handleTrackEnd] Tracks remaining:', filtered.length);
          return filtered;
        });
      }
      
      toast.success("NEXT TRACK", {
        description: arrangedPlaylist[1]?.name || "Queue is empty",
      });
    } else {
      console.log('[handleTrackEnd] No tracks in playlist');
    }
  }, [arrangedPlaylist, isConnected, currentRoom, trackEnded]);

  const handleSkip = useCallback(() => {
    if (arrangedPlaylist.length > 0) {
      handleTrackEnd();
    }
  }, [handleTrackEnd, arrangedPlaylist]);

  // handlePlayPause is now handled by SpotifyPlayer component

  const handleAddTrack = (track: SearchTrack) => {
    const newTrack: Track = {
      ...track,
      id: `${track.id}-${Date.now()}`, // Unique ID for queue ordering
      spotifyId: track.id, // Store original Spotify ID separately
      addedBy: currentUserId,
      addedAt: new Date(),
    };

    setPlaylistTracks(prev => [...prev, newTrack]);
    setAddedTrackIds(prev => new Set([...prev, track.id]));
    
    // Add to my tracks history for AI recommendations
    setMyTracksHistory(prev => {
      // Keep only unique tracks (by original Spotify ID) and last 20
      const originalId = track.id;
      const filtered = prev.filter(t => {
        const tId = t.id.split('-')[0];
        return tId !== originalId;
      });
      return [...filtered, newTrack].slice(-20); // Keep last 20 tracks
    });

    // Send to socket if connected
    if (isConnected && currentRoom) {
      socketAddTrack(newTrack);
    }

    toast.success(`${track.name} added to queue`, {
      description: currentRoom ? "Added to room queue" : "Track arranged using D'Hondt method",
    });
  };

  const myTracks = arrangedPlaylist.filter(t => t.addedBy === currentUserId);

  // AI Recommendations based on my tracks history
  const {
    recommendations: aiRecommendations,
    isLoading: isLoadingRecommendations,
    error: recommendationsError,
    refresh: refreshRecommendations,
  } = useSpotifyRecommendations({
    myTracks: myTracksHistory.length > 0 ? myTracksHistory : myTracks,
    enabled: (myTracksHistory.length > 0 || myTracks.length > 0),
    limit: 10,
  });

  // Convert Spotify recommendations to SearchTrack format
  const aiRecommendationsFormatted = useMemo(() => {
    return aiRecommendations.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || "/placeholder.svg",
      duration: Math.floor(track.duration_ms / 1000),
    }));
  }, [aiRecommendations]);

  // Fetch user's Spotify favorites
  const {
    favorites: spotifyFavorites,
    isLoading: isLoadingFavorites,
    error: favoritesError,
  } = useSpotifyFavorites();

  // Convert favorites to SearchTrack format
  const favoritesFormatted = useMemo(() => {
    return spotifyFavorites.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || "/placeholder.svg",
      duration: Math.floor(track.duration_ms / 1000),
    }));
  }, [spotifyFavorites]);

  // Handle moving tracks in queue
  const handleMoveTrack = useCallback((trackId: string, direction: 'up' | 'down') => {
    if (!currentRoom || !user) return;

    socketMoveTrack(trackId, user.id, direction);
    toast.success(`Moving track ${direction}...`);
  }, [currentRoom, user, socketMoveTrack]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Player */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Room Info */}
            <div className="flex items-center gap-3">
              <div>
                <button
                  onClick={() => {
                    leaveRoom();
                    navigate('/rooms');
                  }}
                  className="text-lg font-bold uppercase hover:text-primary transition-colors cursor-pointer"
                >
                  Wejay
                </button>
                {currentRoom && (
                  <p className="text-xs text-muted-foreground">
                    {currentRoom.name} • {roomUsers.length} user{roomUsers.length !== 1 ? 's' : ''}
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
              playlistId={currentRoom?.spotifyPlaylistId}
            />
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:block uppercase">
                {myTracks.length} {myTracks.length === 1 ? "TRACK" : "TRACKS"}
              </span>
              <div className="neumorphic w-8 h-8 rounded-full overflow-hidden">
                <img 
                  src={user?.images[0]?.url || "/placeholder.svg"} 
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
        {/* Onboarding Banner - show when room is empty */}
        {arrangedPlaylist.length === 0 && currentRoom && (
          <div className="neumorphic p-6 border-2 border-primary/20 mb-6">
            <h2 className="text-lg font-bold mb-2 uppercase">Welcome to {currentRoom.name}!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This room is empty. Start by searching for a track and adding it to the queue. 
              Everyone in the room can add tracks and they'll be fairly arranged using the D'Hondt method.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Search for music</span>
              </div>
              <span>→</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Add to queue</span>
              </div>
              <span>→</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Enjoy together!</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[320px,1fr,340px] gap-6">
          {/* Left Sidebar - Search & Add */}
          <div className="space-y-6 lg:order-1 order-2">
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
            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
              {activeTab === "search" ? (
                isLoading ? (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-50" />
                    <p className="uppercase text-xs">SEARCHING...</p>
                  </div>
                ) : error ? (
                  <div className="neumorphic p-8 text-center text-destructive">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-xs">{error}</p>
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
                    <p className="uppercase text-xs">NO RESULTS</p>
                  </div>
                ) : (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="uppercase text-xs">SEARCH SPOTIFY</p>
                  </div>
                )
              ) : (
                isLoadingFavorites ? (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-50" />
                    <p className="uppercase text-xs">LOADING FAVORITES...</p>
                  </div>
                ) : favoritesError ? (
                  <div className="neumorphic p-8 text-center text-destructive">
                    <Heart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-xs">{favoritesError}</p>
                  </div>
                ) : favoritesFormatted.length > 0 ? (
                  favoritesFormatted.map(track => (
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
                    <Heart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="uppercase mb-1 text-xs">NO FAVORITES</p>
                    <p className="text-xs">Like some tracks on Spotify first</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Center Column - QUEUE (Main Focus) */}
          <div className="space-y-6 lg:order-2 order-1">
            <Playlist 
              tracks={arrangedPlaylist} 
              users={roomUsers} 
              currentUserId={currentUserId}
              onMoveTrack={handleMoveTrack}
            />
          </div>

          {/* Right Sidebar - Users & AI Recommendations */}
          <div className="space-y-6 lg:order-3 order-3">
            {/* Online Users */}
            <OnlineUsers users={roomUsers} currentUserId={currentUserId} />

            {/* Spotify Playlist for Sonos */}
            {currentRoom && (
              <SpotifyPlaylistSync 
                playlistUrl={currentRoom.spotifyPlaylistUrl}
                hasTracksInQueue={playlistTracks.length > 0}
                room={currentRoom}
              />
            )}

            {/* AI Recommendations */}
            <AIRecommendations
              recommendations={aiRecommendationsFormatted}
              isLoading={isLoadingRecommendations}
              error={recommendationsError}
              onAdd={handleAddTrack}
              onRefresh={refreshRecommendations}
              addedTrackIds={addedTrackIds}
              hasMyTracks={myTracks.length > 0}
            />

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
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;