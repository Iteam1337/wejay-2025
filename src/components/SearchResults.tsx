import { SearchTrack } from "@/types/wejay";
import { Search, Heart, Loader2 } from "lucide-react";
import { TrackCard } from "@/components/TrackCard";

interface SearchResultsProps {
  activeTab: "search" | "favorites";
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: SearchTrack[];
  favorites: SearchTrack[];
  isLoadingFavorites: boolean;
  favoritesError: string | null;
  addedTrackIds: Set<string>;
  onAddTrack: (track: SearchTrack) => void;
}

export function SearchResults({
  activeTab,
  isLoading,
  error,
  searchQuery,
  searchResults,
  favorites,
  isLoadingFavorites,
  favoritesError,
  addedTrackIds,
  onAddTrack,
}: SearchResultsProps) {
  if (activeTab === "search") {
    if (isLoading) return <LoadingState message="SEARCHING..." />;
    if (error) return <ErrorState message={error} icon="search" />;
    if (searchResults.length > 0) {
      return (
        <TrackList tracks={searchResults} addedTrackIds={addedTrackIds} onAdd={onAddTrack} />
      );
    }
    if (searchQuery.trim()) return <EmptyState message="NO RESULTS" icon="search" />;
    return <EmptyState message="SEARCH SPOTIFY" icon="search" />;
  }

  // Favorites tab
  if (isLoadingFavorites) return <LoadingState message="LOADING FAVORITES..." />;
  if (favoritesError) return <ErrorState message={favoritesError} icon="heart" />;
  if (favorites.length > 0) {
    return (
      <TrackList tracks={favorites} addedTrackIds={addedTrackIds} onAdd={onAddTrack} />
    );
  }
  if (searchQuery.trim()) {
    return <EmptyState message={`NO RESULTS FOR "${searchQuery}"`} icon="search" />;
  }
  return <EmptyState message="NO FAVORITES" submessage="Like some tracks on Spotify first" icon="heart" />;
}

function TrackList({
  tracks,
  addedTrackIds,
  onAdd,
}: {
  tracks: SearchTrack[];
  addedTrackIds: Set<string>;
  onAdd: (track: SearchTrack) => void;
}) {
  return (
    <>
      {tracks.map((track) => (
        <TrackCard
          key={track.id}
          track={track}
          onAdd={onAdd}
          isAdded={addedTrackIds.has(track.id)}
        />
      ))}
    </>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="neumorphic p-8 text-center text-muted-foreground">
      <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-50" />
      <p className="uppercase text-xs">{message}</p>
    </div>
  );
}

function ErrorState({ message, icon }: { message: string; icon: "search" | "heart" }) {
  const Icon = icon === "search" ? Search : Heart;
  return (
    <div className="neumorphic p-8 text-center text-destructive">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

function EmptyState({
  message,
  submessage,
  icon,
}: {
  message: string;
  submessage?: string;
  icon: "search" | "heart";
}) {
  const Icon = icon === "search" ? Search : Heart;
  return (
    <div className="neumorphic p-8 text-center text-muted-foreground">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p className="uppercase text-xs">{message}</p>
      {submessage && <p className="text-xs mt-1">{submessage}</p>}
    </div>
  );
}
