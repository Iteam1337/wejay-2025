import { useState, useMemo } from "react";
import { SearchBar } from "@/components/SearchBar";
import { TrackCard } from "@/components/TrackCard";
import { TabButton } from "@/components/TabButton";
import { OnlineUsers } from "@/components/OnlineUsers";
import { Playlist } from "@/components/Playlist";
import { mockUsers, mockSearchResults, mockFavorites, mockPlaylistTracks } from "@/lib/mockData";
import { arrangeTracks } from "@/lib/dhondt";
import { Track } from "@/types/wejay";
import { toast } from "sonner";
import { Music2, Heart, Search } from "lucide-react";

type Tab = "search" | "favorites";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>(mockPlaylistTracks);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState(mockUsers);

  const currentUserId = "user-1";

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return mockSearchResults;
    const query = searchQuery.toLowerCase();
    return mockSearchResults.filter(
      track => 
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const arrangedPlaylist = useMemo(() => {
    return arrangeTracks(playlistTracks);
  }, [playlistTracks]);

  const handleAddTrack = (track: Track) => {
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
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="neumorphic w-10 h-10 flex items-center justify-center">
                <Music2 className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-xl font-medium tracking-wide">
                <span className="text-gradient">Wejay</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {myTracks.length} {myTracks.length === 1 ? "bidrag" : "bidrag"}
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
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Sök
                </span>
              </TabButton>
              <TabButton 
                active={activeTab === "favorites"} 
                onClick={() => setActiveTab("favorites")}
              >
                <span className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Favoriter
                </span>
              </TabButton>
            </div>

            {/* Track List */}
            <div className="space-y-3">
              {activeTab === "search" ? (
                filteredSearchResults.length > 0 ? (
                  filteredSearchResults.map(track => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      onAdd={handleAddTrack}
                      isAdded={addedTrackIds.has(track.id)}
                    />
                  ))
                ) : (
                  <div className="neumorphic p-8 text-center text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Inga resultat för "{searchQuery}"</p>
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
                <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <span className="text-primary">Dina bidrag</span>
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
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{myTracks.length - 3} fler
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
