import { useEffect, useRef, useState } from "react";
import { Track } from "@/types/wejay";
import { useAuth } from "@/contexts/AuthContext";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useDevices } from "@/hooks/useDevices";
import { useSocket } from "@/hooks/useSocket";
import {
  loadPlaybackMode,
  savePlaybackMode,
  getTrackSpotifyUri,
  calculateStartPosition,
} from "@/lib/playback-utils";
import { playOnDevice } from "@/lib/spotify";

type PlaybackMode = 'web' | 'spotify' | 'silent';

export function usePlayback(currentTrack: Track | null, playlistId?: string) {
  const { isPremium } = useAuth();
  const { playbackState } = useSocket();
  const { selectedDeviceId } = useDevices();
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
    if (!isPremium) return;

    lastTrackIdRef.current = currentTrack.id;
    const spotifyUri = getTrackSpotifyUri(currentTrack);
    const startPosition = calculateStartPosition(playbackState, currentTrack.id);

    if (selectedDeviceId) {
      // Play on selected device (e.g. Sonos)
      playOnDevice(selectedDeviceId, spotifyUri, startPosition, playlistId);
    } else if (isReady) {
      // Play in web player
      play(spotifyUri, startPosition);
    }
  }, [currentTrack, isReady, isPremium, play, playbackState, playbackMode, selectedDeviceId, playlistId]);

  const handlePlayPause = () => {
    if (!isPremium) return false;
    if (!isReady && !selectedDeviceId) return false;
    togglePlayPause();
    return true;
  };

  const handleSeek = (value: number[]) => {
    if (!isPremium || (!isReady && !selectedDeviceId)) return;
    seek(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!isPremium || (!isReady && !selectedDeviceId)) return;
    setVolume(value[0] / 100);
  };

  return {
    playbackMode,
    setPlaybackMode,
    isReady: isReady || !!selectedDeviceId,
    isPlaying,
    position,
    duration,
    isPremium,
    selectedDeviceId,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    togglePlayPause,
  };
}
