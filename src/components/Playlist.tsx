import { PlaylistEntry, SpotifyUser } from "@/types/wejay";
import { ListMusic, Play, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaylistProps {
  tracks: PlaylistEntry[];
  users: SpotifyUser[];
  currentUserId: string;
  onMoveTrack?: (trackId: string, direction: 'up' | 'down') => void;
}

export function Playlist({ tracks, users, currentUserId, onMoveTrack }: PlaylistProps) {
  const getUser = (userId: string) => {
    return users.find(u => u.id === userId);
  };

  return (
    <div className="neumorphic p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ListMusic className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg uppercase">QUEUE</h2>
          <span className="text-muted-foreground text-sm">
            {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          </span>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ListMusic className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-medium text-lg uppercase mb-2">Queue is empty</p>
          <p className="text-sm text-muted-foreground/80">
            Search for tracks to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map((track, index) => {
            const trackUser = getUser(track.addedBy);
            const isCurrentlyPlaying = index === 0;
            const isOwnTrack = track.addedBy === currentUserId;
            
            return (
              <div 
                key={track.id} 
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-all",
                  isCurrentlyPlaying && "bg-primary/5 border-2 border-primary/20",
                  !isCurrentlyPlaying && "hover:bg-accent/50"
                )}
              >
                {/* Position/Play indicator */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                  {isCurrentlyPlaying ? (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Play className="w-4 h-4 text-primary-foreground fill-current" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center text-muted-foreground font-medium">
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <img 
                    src={track.albumArt} 
                    alt={track.album}
                    className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">
                      {track.name}
                    </h4>
                    <p className="text-muted-foreground text-sm truncate">
                      {track.artist}
                    </p>
                    
                    {/* User info */}
                    <div className="flex items-center gap-2 mt-1">
                      {trackUser && (
                        <img 
                          src={trackUser.images[0]?.url || "/placeholder.svg"} 
                          alt={trackUser.display_name}
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      <p className={cn(
                        "text-xs truncate",
                        isOwnTrack ? "text-primary font-medium" : "text-muted-foreground"
                      )}>
                        {isOwnTrack ? "YOU" : (trackUser?.display_name || "Unknown")}
                      </p>
                    </div>
                  </div>

                  <span className="text-muted-foreground text-sm flex-shrink-0">
                    {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Move buttons - only for own tracks that aren't playing */}
                {isOwnTrack && !isCurrentlyPlaying && onMoveTrack && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => onMoveTrack(track.id, 'up')}
                      disabled={index === 1} // Can't move above position 1 (after currently playing)
                      className={cn(
                        "neumorphic-button p-1 rounded transition-all",
                        index === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-primary/10"
                      )}
                      title="Move up"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onMoveTrack(track.id, 'down')}
                      disabled={index === tracks.length - 1}
                      className={cn(
                        "neumorphic-button p-1 rounded transition-all",
                        index === tracks.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-primary/10"
                      )}
                      title="Move down"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
