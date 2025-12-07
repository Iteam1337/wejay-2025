import { useState, useEffect, useCallback, useRef } from 'react';
import { getSpotifyRecommendations, SpotifyTrack } from '@/lib/spotify';
import { Track } from '@/types/wejay';
import { TrackHistoryEntry } from './useTrackHistory';

interface UseSpotifyRecommendationsOptions {
  myTracks: Track[];
  history?: TrackHistoryEntry[];
  enabled: boolean;
  limit?: number;
  useContext?: boolean; // Use weekday/time context
}

export function useSpotifyRecommendations({
  myTracks,
  enabled,
  limit = 10,
}: UseSpotifyRecommendationsOptions) {
  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const fetchRecommendations = useCallback(async () => {
    console.log('[AI Recommendations] fetchRecommendations called');
    console.log('[AI Recommendations] enabled:', enabled);
    console.log('[AI Recommendations] myTracks.length:', myTracks.length);
    
    if (!enabled || myTracks.length === 0) {
      console.log('[AI Recommendations] Not fetching - disabled or no tracks');
      setRecommendations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Extract unique Spotify track IDs from my tracks
      const trackIds = myTracks
        .map(track => track.spotifyId) // Now we have clean spotifyId field!
        .filter((id, index, self) => self.indexOf(id) === index) // Remove duplicates
        .slice(-5); // Use last 5 unique tracks as seeds (Spotify allows max 5 seeds)

      console.log('[AI Recommendations] Using seed tracks:', trackIds);

      // Get recommendations based on my recent tracks
      const results = await getSpotifyRecommendations({
        seed_tracks: trackIds,
        limit,
        market: 'SE',
      });

      console.log('[AI Recommendations] Got', results.length, 'recommendations');
      setRecommendations(results);
    } catch (err) {
      console.error('[AI Recommendations] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, [myTracks, enabled, limit]);

  // Only fetch once on mount when we have tracks
  useEffect(() => {
    if (!hasInitialized.current && enabled && myTracks.length > 0) {
      console.log('[AI Recommendations] Fetching initial recommendations');
      hasInitialized.current = true;
      fetchRecommendations();
    }
  }, [enabled, myTracks.length]); // Only depend on myTracks.length, not the full array

  const refresh = useCallback(() => {
    console.log('[AI Recommendations] Manual refresh triggered');
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    isLoading,
    error,
    refresh,
  };
}
