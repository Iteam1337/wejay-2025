import { useState, useEffect, useCallback } from "react";
import { searchSpotify, SpotifyTrack } from "@/lib/spotify";

export function useSpotifySearch(query: string, enabled: boolean = true) {
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const tracks = await searchSpotify(query);
        if (!controller.signal.aborted) {
          setResults(tracks);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Sökning misslyckades");
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query, enabled]);

  return { results, isLoading, error };
}
