import { Track } from "@/types/wejay";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/playback-utils";

interface TrackProgressProps {
  track: Track;
  position: number;
  duration: number;
  isPremium: boolean;
  isReady: boolean;
  onSeek: (value: number[]) => void;
}

export function TrackProgress({
  track,
  position,
  duration,
  isPremium,
  isReady,
  onSeek,
}: TrackProgressProps) {
  const maxDuration = duration || track.duration * 1000;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline gap-2 mb-1">
        <p className="text-sm font-medium truncate flex-1">{track.name}</p>
        <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
          {formatTime(position)} / {formatTime(maxDuration)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate mb-1.5">{track.artist}</p>

      {isPremium && isReady ? (
        <Slider
          value={[position]}
          max={maxDuration}
          step={1000}
          onValueChange={onSeek}
          className="cursor-pointer"
        />
      ) : (
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${maxDuration > 0 ? (position / maxDuration) * 100 : 0}%` }}
          />
        </div>
      )}
    </div>
  );
}
