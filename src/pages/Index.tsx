import { useState, useMemo, useCallback } from "react";
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
import { Heart, Search, Loader2 } from "lucide-react";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";

type Tab = "search" | "favorites";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>(mockPlaylistTracks);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState(mockUsers);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentUserId = "user-1";

  const { results: spotifyResults, isLoading, error } = useSpotifySearch(
    searchQuery,
    activeTab === "search"
  );

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
      toast.success("NÄSTA LÅT", {
        description: arrangedPlaylist[1]?.name || "Kön är tom",
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
      toast.error("KÖN ÄR TOM", {
        description: "Lägg till låtar för att spela",
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

    toast.success(`${track.name} tillagd i kön`, {
      description: "Låten är arrangerad enligt D'Hondt",
    });
  };

  const myTracks = arrangedPlaylist.filter(t => t.addedBy === currentUserId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Player */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-3">
          <div className="flex items-center justify-between gap-4">
            <SpotifyPlayer
              currentTrack={currentTrack}
              onTrackEnd={handleTrackEnd}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSkip={handleSkip}
            />
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:block uppercase">
                {myTracks.length} BIDRAG
              </span>
              <div className="neumorphic w-8 h-8 rounded-full overflow-hidden">
                <img 
                  src={mockUsers[0].avatar} 
                  alt="Du"
                  className="w-full h-full object-cover"
                />
              </div>
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
                  SÖK
                </span>
              </TabButton>
              <TabButton 
                active={activeTab === "favorites"} 
                onClick={() => setActiveTab("favorites")}
              >
                <span className="flex items-center gap-2 uppercase">
                  <Heart className="w-4 h-4" />
                  FAVORITER
                </span>
              </TabButton>
            </div>

            {/* Track List */}
            <div className="space-y-3">
              {activeTab === "search" ? (
                isLoading ? (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-50" />
                    <p className="uppercase">SÖKER PÅ SPOTIFY...</p>
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
                    <p>Inga resultat för "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="uppercase">SÖK EFTER LÅTAR PÅ SPOTIFY</p>
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
                  <span className="text-primary">DINA BIDRAG</span>
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
                        +{myTracks.length - 3} FLER
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
