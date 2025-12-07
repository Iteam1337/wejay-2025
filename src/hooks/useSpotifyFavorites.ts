import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserSavedTracks, SpotifyTrack } from '@/lib/spotify';

export function useSpotifyFavorites() {
  const [favorites, setFavorites] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const fetchFavorites = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Favorites] Fetching saved tracks from Spotify');
      const tracks = await getUserSavedTracks(50);
      setFavorites(tracks);
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
      setFavorites([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Only fetch once on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      console.log('[Favorites] Initial fetch on mount');
      hasInitialized.current = true;
      fetchFavorites();
    }
  }, []); // Empty dependency array - only run once on mount

  return {
    favorites,
    isLoading,
    error,
    refresh: fetchFavorites,
  };
}
