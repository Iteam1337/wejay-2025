import { SearchTrack } from "@/types/wejay";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackCardProps {
  track: SearchTrack;
  onAdd?: (track: SearchTrack) => void;
  isAdded?: boolean;
  showAddedBy?: boolean;
  userName?: string;
  isOwn?: boolean;
}

export function TrackCard({ 
  track, 
  onAdd, 
  isAdded = false, 
  showAddedBy = false,
  userName,
  isOwn = false
}: TrackCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={cn(
        "neumorphic p-3 flex items-center gap-3 animate-slide-up",
        isOwn && "ring-1 ring-primary/30"
      )}
    >
      <img 
        src={track.albumArt} 
        alt={track.album}
        className="w-12 h-12 rounded-md object-cover flex-shrink-0"
      />
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate text-sm">
          {track.name}
        </h4>
        <p className="text-muted-foreground text-xs truncate">
          {track.artist}
        </p>
        {showAddedBy && userName && (
          <p className={cn(
            "text-xs mt-0.5 truncate uppercase",
            isOwn ? "text-primary" : "text-muted-foreground"
          )}>
            {isOwn ? "YOU" : userName}
          </p>
        )}
      </div>

      <span className="text-muted-foreground text-xs flex-shrink-0">
        {formatDuration(track.duration)}
      </span>

      {onAdd && (
        <button
          onClick={() => !isAdded && onAdd(track)}
          disabled={isAdded}
          className={cn(
            "neumorphic-button w-9 h-9 flex items-center justify-center flex-shrink-0 transition-all",
            isAdded && "neumorphic-pressed text-primary"
          )}
        >
          {isAdded ? (
            <Check className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
