import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, ExternalLink, Crown, Volume2, ChevronDown, Monitor, Headphones, Volume1 } from "lucide-react";
import { Track } from "@/types/wejay";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useSocket } from "@/hooks/useSocket";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type PlaybackMode = 'web' | 'spotify' | 'silent';

interface SpotifyPlayerProps {
  currentTrack: Track | null;
  onTrackEnd: () => void;
  playlistId?: string;
}

export function SpotifyPlayer({ 
  currentTrack, 
  onTrackEnd,
  playlistId,
}: SpotifyPlayerProps) {
  const { user, isPremium } = useAuth();
  const { playbackState } = useSocket();
  const lastTrackIdRef = useRef<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => {
    // Load from localStorage or default to 'spotify' if playlist exists
    const saved = localStorage.getItem('wejay_playback_mode') as PlaybackMode;
    if (saved && ['web', 'spotify', 'silent'].includes(saved)) {
      return saved;
    }
    return playlistId ? 'spotify' : 'web';
  });

  // Save playback mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('wejay_playback_mode', playbackMode);
  }, [playbackMode]);
  
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

  // Auto-play when currentTrack ID changes based on playback mode
  useEffect(() => {
    if (!currentTrack) return;

    // Only play if this is a new track
    if (lastTrackIdRef.current === currentTrack.id) return;
    lastTrackIdRef.current = currentTrack.id;

    // Silent mode - don't play anything
    if (playbackMode === 'silent') {
      console.log('Silent mode - not playing');
      return;
    }

    // Spotify mode - user controls from Spotify app
    if (playbackMode === 'spotify') {
      console.log('Spotify mode - user controls from Spotify app/Sonos');
      return;
    }

    // Web mode - auto-play in web player
    if (playbackMode === 'web') {
      if (!isReady || !isPremium) {
        console.log('Web player not ready or not premium');
        return;
      }

      // Convert track ID to Spotify URI (use spotifyId if available)
      const spotifyTrackId = currentTrack.spotifyId || currentTrack.id.split('-')[0];
      const spotifyUri = `spotify:track:${spotifyTrackId}`;
      
      // Check if playback state is for THIS track or a different one
      const isCurrentTrackInPlaybackState = playbackState.currentTrackId === currentTrack.id;
      
      let startPosition = 0;
      
      if (isCurrentTrackInPlaybackState) {
        // Same track - calculate elapsed time since track started
        const now = Date.now();
        const elapsedMs = now - playbackState.timestamp;
        startPosition = playbackState.position + elapsedMs;
        console.log('Auto-playing track:', currentTrack.name, 'at position:', Math.floor(startPosition / 1000), 's');
      } else {
        // New track - start from beginning
        console.log('Auto-playing NEW track:', currentTrack.name, 'from beginning');
      }
      
      // Play from calculated position
      play(spotifyUri, startPosition);
    }
  }, [currentTrack?.id, isReady, isPremium, play, playbackState, playbackMode]);

  // Track ended - call onTrackEnd
  useEffect(() => {
    if (duration > 0 && position >= duration - 1000) {
      console.log('Track ended, skipping to next...');
      onTrackEnd();
    }
  }, [position, duration, onTrackEnd]);

  const handlePlayPause = () => {
    if (!isPremium) {
      // Fallback to opening Spotify
      if (currentTrack) {
        const spotifyTrackId = currentTrack.id.split('-')[0];
        window.open(`https://open.spotify.com/track/${spotifyTrackId}`, '_blank');
      }
      return;
    }

    if (!isReady) {
      console.log('Player not ready yet...');
      return;
    }

    togglePlayPause();
  };

  const handleSkip = () => {
    // In web mode, only skip if player is ready
    if (playbackMode === 'web' && (!isPremium || !isReady)) return;
    
    // Skip works in all modes - just removes track from queue
    onTrackEnd();
  };

  const handleSeek = (value: number[]) => {
    if (!isPremium || !isReady) return;
    seek(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!isPremium || !isReady) return;
    setVolume(value[0] / 100);
  };

  const openInSpotify = () => {
    if (currentTrack) {
      const spotifyTrackId = currentTrack.id.split('-')[0];
      window.open(`https://open.spotify.com/track/${spotifyTrackId}`, '_blank');
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getModeIcon = () => {
    switch (playbackMode) {
      case 'web': return <Monitor className="w-3 h-3" />;
      case 'spotify': return <Headphones className="w-3 h-3" />;
      case 'silent': return <Volume1 className="w-3 h-3" />;
    }
  };

  const getModeLabel = () => {
    switch (playbackMode) {
      case 'web': return 'Web Player';
      case 'spotify': return 'Spotify/Sonos';
      case 'silent': return 'Silent (no playback)';
    }
  };

  return (
    <div className="flex items-center gap-3 flex-1">
      {/* Play/Pause & Skip Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-stretch neumorphic rounded-lg overflow-hidden">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className={cn(
              "w-10 h-10 flex items-center justify-center transition-all",
              isPlaying && playbackMode === 'web' && "bg-primary/10",
              playbackMode !== 'web' && "opacity-50 cursor-not-allowed"
            )}
            disabled={playbackMode !== 'web' || (!isPremium && !currentTrack)}
            title={playbackMode !== 'web' ? `Playback controlled via ${getModeLabel()}` : !isPremium ? "Spotify Premium required" : isReady ? "Play/Pause" : "Connecting..."}
          >
            {isPlaying && playbackMode === 'web' ? (
              <Pause className="w-4 h-4 text-primary fill-current" />
            ) : (
              <Play className="w-4 h-4 text-primary fill-current ml-0.5" />
            )}
          </button>
          
          {/* Dropdown for playback mode */}
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
        </div>
        
        <button
          onClick={handleSkip}
          className="neumorphic-button w-10 h-10 flex items-center justify-center flex-shrink-0"
          disabled={!currentTrack}
          title="Skip to next track"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Track Info & Progress */}
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
              <ExternalLink className="w-3 h-3 text-white" />
            </div>
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <p className="text-sm font-medium truncate flex-1">{currentTrack.name}</p>
              <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                {formatTime(position)} / {formatTime(duration || currentTrack.duration * 1000)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mb-1.5">{currentTrack.artist}</p>
            
            {/* Progress Bar */}
            {isPremium && isReady ? (
              <Slider
                value={[position]}
                max={duration || currentTrack.duration * 1000}
                step={1000}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
            ) : (
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
          
          {/* Volume Control */}
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
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1">
            <h1 className="text-base font-medium tracking-wide uppercase">
              <span className="text-gradient">WEJAY</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {playbackMode === 'web' && !isReady && isPremium ? 'Connecting to Spotify...' :
                 playbackMode === 'web' ? 'Playing in browser' :
                 playbackMode === 'spotify' ? 'Control from Spotify app' :
                 'Silent mode'}
              </span>
            </div>
          </div>
          
          {/* Mode indicator badge */}
          <div className="neumorphic px-2 py-1 rounded-full flex items-center gap-1.5">
            {getModeIcon()}
            <span className="text-xs font-medium">{getModeLabel()}</span>
          </div>
          
          {/* Premium Badge */}
          {isPremium && user && (
            <div className="neumorphic px-2 py-1 rounded-full flex items-center gap-1">
              <Crown className="w-3 h-3 text-yellow-500" />
              <span className="text-xs font-medium text-yellow-600">Premium</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}