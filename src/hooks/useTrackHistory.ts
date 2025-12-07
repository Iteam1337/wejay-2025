import { useState, useEffect, useCallback } from 'react';

export interface TrackHistoryEntry {
  trackId: string;
  trackName: string;
  artist: string;
  timestamp: string;
  weekday: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  roomId: string;
}

interface UseTrackHistoryOptions {
  roomId: string | undefined;
  userId: string | undefined;
  enabled: boolean;
}

export function useTrackHistory({ roomId, userId, enabled }: UseTrackHistoryOptions) {
  const [history, setHistory] = useState<TrackHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!enabled || !roomId || !userId) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Track History] Fetching history for', userId, 'in room', roomId);
      
      const response = await fetch(`/api/rooms/${roomId}/history/${userId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch track history');
      }

      const data: TrackHistoryEntry[] = await response.json();
      console.log('[Track History] Loaded', data.length, 'history entries');
      setHistory(data);
    } catch (err) {
      console.error('[Track History] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, userId, enabled]);

  useEffect(() => {
    if (enabled && roomId && userId) {
      fetchHistory();
    }
  }, [enabled, roomId, userId]); // Fetch when room or user changes

  return {
    history,
    isLoading,
    error,
    refresh: fetchHistory,
  };
}

// Helper function to get tracks played on the same weekday
export function getTracksForWeekday(history: TrackHistoryEntry[], weekday: number): string[] {
  return history
    .filter(entry => entry.weekday === weekday)
    .map(entry => entry.trackId);
}

// Helper function to get tracks played at similar time
export function getTracksForTimeOfDay(history: TrackHistoryEntry[], currentHour: number, hourWindow: number = 3): string[] {
  return history
    .filter(entry => Math.abs(entry.hour - currentHour) <= hourWindow)
    .map(entry => entry.trackId);
}

// Helper function to get tracks for same weekday AND time
export function getTracksForContext(history: TrackHistoryEntry[], weekday: number, hour: number): string[] {
  return history
    .filter(entry => entry.weekday === weekday && Math.abs(entry.hour - hour) <= 2)
    .map(entry => entry.trackId);
}
