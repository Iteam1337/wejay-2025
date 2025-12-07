import { useState, useEffect, useCallback } from "react";
import { Play, Pause, SkipForward, ExternalLink } from "lucide-react";
import { Track } from "@/types/wejay";
import { cn } from "@/lib/utils";

interface SpotifyPlayerProps {
  currentTrack: Track | null;
  onTrackEnd: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
}

export function SpotifyPlayer({ 
  currentTrack, 
  onTrackEnd, 
  isPlaying, 
  onPlayPause,
  onSkip 
}: SpotifyPlayerProps) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Reset progress when track changes
  useEffect(() => {
    setProgress(0);
    setElapsed(0);
  }, [currentTrack?.id]);

  // Timer for track progress
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;

    const interval = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next >= currentTrack.duration) {
          onTrackEnd();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, onTrackEnd]);

  // Update progress percentage
  useEffect(() => {
    if (currentTrack) {
      setProgress((elapsed / currentTrack.duration) * 100);
    }
  }, [elapsed, currentTrack]);

  // Open Spotify client when starting playback
  const handlePlayPause = useCallback(() => {
    if (!isPlaying && currentTrack) {
      // Extract the original Spotify track ID (before our timestamp suffix)
      const spotifyTrackId = currentTrack.id.split('-')[0];
      // Open Spotify URI - will open in Spotify app if installed, otherwise web player
      window.open(`spotify:track:${spotifyTrackId}`, '_blank');
    }
    onPlayPause();
  }, [isPlaying, currentTrack, onPlayPause]);

  const openInSpotify = useCallback(() => {
    if (currentTrack) {
      const spotifyTrackId = currentTrack.id.split('-')[0];
      window.open(`https://open.spotify.com/track/${spotifyTrackId}`, '_blank');
    }
  }, [currentTrack]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 flex-1">
      {/* Play/Pause Button as Logo */}
      <button
        onClick={handlePlayPause}
        className={cn(
          "neumorphic w-12 h-12 flex items-center justify-center transition-all",
          isPlaying && "neumorphic-pressed"
        )}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 text-primary fill-current" />
        ) : (
          <Play className="w-5 h-5 text-primary fill-current ml-0.5" />
        )}
      </button>

      {/* Track Info & Progress */}
      {currentTrack ? (
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <button 
            onClick={openInSpotify}
            className="relative group flex-shrink-0"
          >
            <img 
              src={currentTrack.albumArt} 
              alt={currentTrack.album}
              className="w-10 h-10 rounded object-cover"
            />
            <div className="absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-white" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{currentTrack.name}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatTime(elapsed)} / {formatTime(currentTrack.duration)}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Skip Button */}
          <button
            onClick={onSkip}
            className="neumorphic-button w-8 h-8 flex items-center justify-center flex-shrink-0"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-medium tracking-wide uppercase">
            <span className="text-gradient">WEJAY</span>
          </h1>
        </div>
      )}
    </div>
  );
}
