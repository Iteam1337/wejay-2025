import { Track } from "@/types/wejay";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayback } from "@/hooks/usePlayback";
import { PlaybackControls } from "./PlaybackControls";
import { TrackProgress } from "./TrackProgress";
import { Volume2, Crown, Monitor, Headphones, Volume1 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { getModeLabel, getModeIcon, getSpotifyTrackUrl } from "@/lib/playback-utils";

interface SpotifyPlayerProps {
  currentTrack: Track | null;
  onTrackEnd: () => void;
  playlistId?: string;
  playlistUrl?: string;
}

export function SpotifyPlayer({
  currentTrack,
  onTrackEnd,
  playlistId,
  playlistUrl,
}: SpotifyPlayerProps) {
  const { user, isPremium } = useAuth();
  const {
    playbackMode,
    setPlaybackMode,
    isReady,
    isPlaying,
    position,
    duration,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
  } = usePlayback(currentTrack, playlistId);

  const handleSkip = () => {
    if (playbackMode === 'web' && (!isPremium || !isReady)) return;
    onTrackEnd();
  };

  const openInSpotify = () => {
    if (currentTrack) {
      window.open(getSpotifyTrackUrl(currentTrack), '_blank');
    }
  };

  return (
    <div className="flex items-center gap-3 flex-1">
      <PlaybackControls
        playbackMode={playbackMode}
        setPlaybackMode={setPlaybackMode}
        isPlaying={isPlaying}
        isPremium={isPremium}
        isReady={isReady}
        currentTrack={currentTrack}
        playlistUrl={playlistUrl}
        onPlayPause={handlePlayPause}
        onSkip={handleSkip}
      />

      {currentTrack ? (
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <button
            onClick={openInSpotify}
            className="relative group flex-shrink-0"
            title="Open in Spotify"
          >
            <img
              src={currentTrack.albumArt}
              alt={currentTrack.album}
              className="w-10 h-10 rounded object-cover"
            />
            <div className="absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ExternalLinkIcon />
            </div>
          </button>

          <TrackProgress
            track={currentTrack}
            position={position}
            duration={duration}
            isPremium={isPremium}
            isReady={isReady}
            onSeek={handleSeek}
          />

          {isPremium && isReady && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider
                defaultValue={[50]}
                max={100}
                step={1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          playbackMode={playbackMode}
          isPremium={isPremium}
          isReady={isReady}
          playlistUrl={playlistUrl}
          user={user}
        />
      )}
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function EmptyState({
  playbackMode,
  isPremium,
  isReady,
  playlistUrl,
  user,
}: {
  playbackMode: string;
  isPremium: boolean;
  isReady: boolean;
  playlistUrl?: string;
  user: ReturnType<typeof useAuth>["user"];
}) {
  const getStatusMessage = () => {
    if (playbackMode === 'web' && !isReady && isPremium) return 'Connecting to Spotify...';
    if (playbackMode === 'web') return 'Playing in browser';
    if (playbackMode === 'spotify') {
      return playlistUrl ? 'Open playlist in Spotify to play on Sonos' : 'Control from Spotify app';
    }
    return 'Silent mode';
  };

  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1">
        <h1 className="text-base font-medium tracking-wide uppercase">
          <span className="text-gradient">WEJAY</span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{getStatusMessage()}</span>
        </div>
      </div>

      <div className="neumorphic px-2 py-1 rounded-full flex items-center gap-1.5">
        <ModeIcon mode={playbackMode} />
        <span className="text-xs font-medium">{getModeLabel(playbackMode as never)}</span>
      </div>

      {isPremium && user && (
        <div className="neumorphic px-2 py-1 rounded-full flex items-center gap-1">
          <Crown className="w-3 h-3 text-yellow-500" />
          <span className="text-xs font-medium text-yellow-600">Premium</span>
        </div>
      )}
    </div>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  const iconName = getModeIcon(mode as never);
  const icons = {
    Monitor: <Monitor className="w-3 h-3" />,
    Headphones: <Headphones className="w-3 h-3" />,
    Volume1: <Volume1 className="w-3 h-3" />,
  };
  return icons[iconName as keyof typeof icons] || null;
}
