import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/wejay";
import { useAuth } from "@/contexts/AuthContext";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useSocket } from "@/hooks/useSocket";
import {
  loadPlaybackMode,
  savePlaybackMode,
  getTrackSpotifyUri,
  calculateStartPosition,
} from "@/lib/playback-utils";

type PlaybackMode = 'web' | 'spotify' | 'silent';

export function usePlayback(currentTrack: Track | null, playlistId?: string) {
  const { isPremium } = useAuth();
  const { playbackState } = useSocket();
  const lastTrackIdRef = useRef<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() =>
    loadPlaybackMode(playlistId)
  );

  const {
    isReady,
    isPlaying,
    position,
    duration,
    play,
    togglePlayPause,
    seek,
    setVolume,
  } = useSpotifyPlayer();

  // Save playback mode to localStorage
  useEffect(() => {
    savePlaybackMode(playbackMode);
  }, [playbackMode]);

  // Auto-play when currentTrack changes in web mode
  useEffect(() => {
    if (!currentTrack || playbackMode !== 'web') return;
    if (lastTrackIdRef.current === currentTrack.id) return;
    if (!isReady || !isPremium) return;

    lastTrackIdRef.current = currentTrack.id;
    const spotifyUri = getTrackSpotifyUri(currentTrack);
    const startPosition = calculateStartPosition(playbackState, currentTrack.id);

    play(spotifyUri, startPosition);
  }, [currentTrack, isReady, isPremium, play, playbackState, playbackMode]);

  const handlePlayPause = () => {
    if (!isPremium) {
      // Fallback handled by component
      return false;
    }
    if (!isReady) return false;
    togglePlayPause();
    return true;
  };

  const handleSeek = (value: number[]) => {
    if (!isPremium || !isReady) return;
    seek(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!isPremium || !isReady) return;
    setVolume(value[0] / 100);
  };

  return {
    playbackMode,
    setPlaybackMode,
    isReady,
    isPlaying,
    position,
    duration,
    isPremium,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    togglePlayPause,
  };
}
