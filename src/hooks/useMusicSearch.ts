import { useState, useMemo } from "react";
import { formatSearchResults } from "@/lib/track-formatters";
import { useSpotifySearch } from "@/hooks/useSpotifySearch";
import { useSpotifyFavorites } from "@/hooks/useSpotifyFavorites";
import { useSpotifyRecommendations } from "@/hooks/useSpotifyRecommendations";
import { Track } from "@/types/wejay";

type Tab = "search" | "favorites";

export function useMusicSearch(myTracks: Track[], myTracksHistory: Track[]) {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");

  const { results: spotifyResults, isLoading, error } = useSpotifySearch(
    searchQuery,
    activeTab === "search"
  );

  const {
    favorites: spotifyFavorites,
    isLoading: isLoadingFavorites,
    error: favoritesError,
  } = useSpotifyFavorites();

  const {
    recommendations: aiRecommendations,
    isLoading: isLoadingRecommendations,
    error: recommendationsError,
    refresh: refreshRecommendations,
  } = useSpotifyRecommendations({
    myTracks: myTracksHistory.length > 0 ? myTracksHistory : myTracks,
    enabled: myTracksHistory.length > 0 || myTracks.length > 0,
    limit: 10,
  });

  const searchResults = useMemo(() => formatSearchResults(spotifyResults), [spotifyResults]);
  const favoritesFormatted = useMemo(() => formatSearchResults(spotifyFavorites), [spotifyFavorites]);
  const aiRecommendationsFormatted = useMemo(() => formatSearchResults(aiRecommendations), [aiRecommendations]);

  return {
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
  };
}
