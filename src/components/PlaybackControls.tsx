import { Play, Pause, SkipForward, ChevronDown, Monitor, Headphones, Volume1, Music } from "lucide-react";
import { Track } from "@/types/wejay";
import { cn } from "@/lib/utils";
import { getModeLabel } from "@/lib/playback-utils";
import { getSpotifyTrackUrl } from "@/lib/playback-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type PlaybackMode = 'web' | 'spotify' | 'silent';

interface PlaybackControlsProps {
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
  isPlaying: boolean;
  isPremium: boolean;
  isReady: boolean;
  currentTrack: Track | null;
  playlistUrl?: string;
  onPlayPause: () => void;
  onSkip: () => void;
}

export function PlaybackControls({
  playbackMode,
  setPlaybackMode,
  isPlaying,
  isPremium,
  isReady,
  currentTrack,
  playlistUrl,
  onPlayPause,
  onSkip,
}: PlaybackControlsProps) {
  const handlePlayPauseClick = () => {
    if (!isPremium && currentTrack) {
      window.open(getSpotifyTrackUrl(currentTrack), '_blank');
      return;
    }
    onPlayPause();
  };

  const openPlaylistInSpotify = () => {
    if (playlistUrl) {
      window.open(playlistUrl, '_blank');
    }
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="flex items-stretch neumorphic rounded-lg overflow-hidden">
        <button
          onClick={handlePlayPauseClick}
          className={cn(
            "w-10 h-10 flex items-center justify-center transition-all",
            isPlaying && playbackMode === 'web' && "bg-primary/10",
            playbackMode !== 'web' && "opacity-50 cursor-not-allowed"
          )}
          disabled={playbackMode !== 'web' || (!isPremium && !currentTrack)}
          title={getPlayButtonTitle(playbackMode, isPremium, isReady)}
        >
          {isPlaying && playbackMode === 'web' ? (
            <Pause className="w-4 h-4 text-primary fill-current" />
          ) : (
            <Play className="w-4 h-4 text-primary fill-current ml-0.5" />
          )}
        </button>

        <PlaybackModeDropdown
          playbackMode={playbackMode}
          setPlaybackMode={setPlaybackMode}
        />
      </div>

      {playbackMode === 'spotify' && playlistUrl && (
        <button
          onClick={openPlaylistInSpotify}
          className="neumorphic-button px-3 h-10 flex items-center gap-2 flex-shrink-0 text-sm font-medium text-[#1DB954] hover:text-[#1ed760]"
          title="Open playlist in Spotify to play on Sonos"
        >
          <Music className="w-4 h-4" />
          <span className="hidden sm:inline">Open in Spotify</span>
        </button>
      )}

      <button
        onClick={onSkip}
        className="neumorphic-button w-10 h-10 flex items-center justify-center flex-shrink-0"
        disabled={!currentTrack}
        title="Skip to next track"
      >
        <SkipForward className="w-4 h-4" />
      </button>
    </div>
  );
}

function getPlayButtonTitle(mode: PlaybackMode, isPremium: boolean, isReady: boolean): string {
  if (mode !== 'web') return `Playback controlled via ${getModeLabel(mode)}`;
  if (!isPremium) return "Spotify Premium required";
  return isReady ? "Play/Pause" : "Connecting...";
}

function PlaybackModeDropdown({
  playbackMode,
  setPlaybackMode,
}: {
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-6 h-10 flex items-center justify-center border-l border-border/50 hover:bg-accent transition-colors"
          title="Playback mode"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem
          onClick={() => setPlaybackMode('web')}
          className={cn("cursor-pointer", playbackMode === 'web' && "bg-accent")}
        >
          <Monitor className="w-4 h-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">Web Player</div>
            <div className="text-xs text-muted-foreground">Play in browser</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setPlaybackMode('spotify')}
          className={cn("cursor-pointer", playbackMode === 'spotify' && "bg-accent")}
        >
          <Headphones className="w-4 h-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">Spotify/Sonos</div>
            <div className="text-xs text-muted-foreground">Control from Spotify app</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => setPlaybackMode('silent')}
          className={cn("cursor-pointer", playbackMode === 'silent' && "bg-accent")}
        >
          <Volume1 className="w-4 h-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">Silent</div>
            <div className="text-xs text-muted-foreground">No playback</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
