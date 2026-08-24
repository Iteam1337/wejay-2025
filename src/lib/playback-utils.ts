type PlaybackMode = 'web' | 'spotify' | 'silent';

const VALID_MODES: PlaybackMode[] = ['web', 'spotify', 'silent'];
const STORAGE_KEY = 'wejay_playback_mode';

export function loadPlaybackMode(playlistId?: string): PlaybackMode {
  const saved = localStorage.getItem(STORAGE_KEY) as PlaybackMode;
  if (saved && VALID_MODES.includes(saved)) {
    return saved;
  }
  return playlistId ? 'spotify' : 'web';
}

export function savePlaybackMode(mode: PlaybackMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function getModeIcon(mode: PlaybackMode): string {
  switch (mode) {
    case 'web': return 'Monitor';
    case 'spotify': return 'Headphones';
    case 'silent': return 'Volume1';
  }
}

export function getModeLabel(mode: PlaybackMode): string {
  switch (mode) {
    case 'web': return 'Web Player';
    case 'spotify': return 'Spotify/Sonos';
    case 'silent': return 'Silent (no playback)';
  }
}

export function getTrackSpotifyUri(track: { spotifyId?: string; id: string }): string {
  const spotifyTrackId = track.spotifyId || track.id.split('-')[0];
  return `spotify:track:${spotifyTrackId}`;
}

export function getSpotifyTrackUrl(track: { spotifyId?: string; id: string }): string {
  const spotifyTrackId = track.spotifyId || track.id.split('-')[0];
  return `https://open.spotify.com/track/${spotifyTrackId}`;
}

export function calculateStartPosition(
  playbackState: { currentTrackId: string | null; position: number; timestamp: number },
  currentTrackId: string
): number {
  if (playbackState.currentTrackId !== currentTrackId) {
    return 0;
  }
  const elapsedMs = Date.now() - playbackState.timestamp;
  return playbackState.position + elapsedMs;
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
