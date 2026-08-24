import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface WebPlaybackError {
  message: string;
}

interface WebPlaybackReady {
  device_id: string;
}

interface WebPlaybackNotReady {
  device_id: string;
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, callback: (data: unknown) => void) => void;
  removeListener: (event: string) => void;
  getCurrentState: () => Promise<WebPlaybackState | null>;
  setName: (name: string) => Promise<void>;
  getVolume: () => Promise<number>;
  setVolume: (volume: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (position_ms: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
}

interface WebPlaybackState {
  position: number;
  duration: number;
  paused: boolean;
  track_window: {
    current_track: {
      id: string;
      uri: string;
      name: string;
      artists: { name: string }[];
      album: {
        name: string;
        images: { url: string }[];
      };
      duration_ms: number;
    };
  };
}

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export function useSpotifyPlayer() {
  const { accessToken, isPremium } = useAuth();
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<WebPlaybackState['track_window']['current_track'] | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  // Initialize Spotify Player
  useEffect(() => {
    if (!accessToken || !isPremium) {
      console.log('Spotify Player: Not ready - no token or not premium');
      return;
    }

    const initializePlayer = () => {
      console.log('Spotify Player: Initializing...');

      const spotifyPlayer = new window.Spotify.Player({
        name: 'Wejay Player',
        getOAuthToken: (cb) => {
          cb(accessToken);
        },
        volume: 0.5,
      });

      // Error handling
      spotifyPlayer.addListener('initialization_error', (data: unknown) => {
        const { message } = data as WebPlaybackError;
        console.error('Spotify Player initialization error:', message);
      });

      spotifyPlayer.addListener('authentication_error', (data: unknown) => {
        const { message } = data as WebPlaybackError;
        console.error('Spotify Player authentication error:', message);
      });

      spotifyPlayer.addListener('account_error', (data: unknown) => {
        const { message } = data as WebPlaybackError;
        console.error('Spotify Player account error:', message);
      });

      spotifyPlayer.addListener('playback_error', (data: unknown) => {
        const { message } = data as WebPlaybackError;
        console.error('Spotify Player playback error:', message);
      });

      // Ready
      spotifyPlayer.addListener('ready', (data: unknown) => {
        const { device_id } = data as WebPlaybackReady;
        console.log('Spotify Player: Ready with device ID', device_id);
        setDeviceId(device_id);
        setIsReady(true);
      });

      // Not Ready
      spotifyPlayer.addListener('not_ready', (data: unknown) => {
        const { device_id } = data as WebPlaybackNotReady;
        console.log('Spotify Player: Device has gone offline', device_id);
        setIsReady(false);
      });

      // Player state changed
      spotifyPlayer.addListener('player_state_changed', (data: unknown) => {
        const state = data as WebPlaybackState | null;
        if (!state) {
          setCurrentTrack(null);
          setIsPlaying(false);
          return;
        }

        setCurrentTrack(state.track_window.current_track);
        setIsPlaying(!state.paused);
        setPosition(state.position);
        setDuration(state.duration);
      });

      // Connect to the player
      spotifyPlayer.connect().then((success) => {
        if (success) {
          console.log('Spotify Player: Connected successfully');
        }
      });

      setPlayer(spotifyPlayer);
      playerRef.current = spotifyPlayer;
    };

    // Wait for Spotify SDK to load
    if (window.Spotify) {
      initializePlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initializePlayer;
    }

    // Cleanup
    return () => {
      if (playerRef.current) {
        console.log('Spotify Player: Disconnecting...');
        playerRef.current.disconnect();
      }
    };
  }, [accessToken, isPremium]);

  // Play a track by URI with optional position and playlist context
  const play = useCallback(async (trackUri: string, positionMs?: number, playlistUri?: string) => {
    if (!deviceId || !accessToken) {
      console.error('Cannot play: device not ready or no access token');
      return;
    }

    try {
      const body: Record<string, unknown> = {};
      
      // If playlist context is provided, play from playlist
      if (playlistUri) {
        body.context_uri = playlistUri;
        // Find track position in playlist by URI
        body.offset = { uri: trackUri };
        console.log('Playing track from playlist:', playlistUri, 'track:', trackUri);
      } else {
        // Play single track without context
        body.uris = [trackUri];
        console.log('Playing track:', trackUri);
      }
      
      // If position is specified, start from that position
      if (positionMs !== undefined) {
        body.position_ms = Math.floor(positionMs);
        console.log('Starting at position:', positionMs, 'ms');
      }
      
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error('Failed to play track:', error);
    }
  }, [deviceId, accessToken]);

  // Pause playback
  const pause = useCallback(async () => {
    if (!player) return;
    await player.pause();
  }, [player]);

  // Resume playback
  const resume = useCallback(async () => {
    if (!player) return;
    await player.resume();
  }, [player]);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (!player) return;
    await player.togglePlay();
  }, [player]);

  // Skip to next track
  const skipToNext = useCallback(async () => {
    if (!player) return;
    await player.nextTrack();
  }, [player]);

  // Skip to previous track
  const skipToPrevious = useCallback(async () => {
    if (!player) return;
    await player.previousTrack();
  }, [player]);

  // Seek to position
  const seek = useCallback(async (positionMs: number) => {
    if (!player) return;
    await player.seek(positionMs);
  }, [player]);

  // Set volume (0-1)
  const setVolume = useCallback(async (volume: number) => {
    if (!player) return;
    await player.setVolume(volume);
  }, [player]);

  return {
    player,
    deviceId,
    isReady,
    isPlaying,
    currentTrack,
    position,
    duration,
    play,
    pause,
    resume,
    togglePlayPause,
    skipToNext,
    skipToPrevious,
    seek,
    setVolume,
  };
}