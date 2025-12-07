import { PlaylistEntry, User } from "@/types/wejay";
import { TrackCard } from "./TrackCard";
import { ListMusic, Play } from "lucide-react";

interface PlaylistProps {
  tracks: PlaylistEntry[];
  users: User[];
  currentUserId: string;
}

export function Playlist({ tracks, users, currentUserId }: PlaylistProps) {
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || "Unknown";
  };

  return (
    <div className="neumorphic p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 uppercase">
          <ListMusic className="w-4 h-4 text-primary" />
          <h3 className="font-medium">QUEUE</h3>
          <span className="text-muted-foreground text-sm">
            ({tracks.length} {tracks.length === 1 ? "TRACK" : "TRACKS"})
          </span>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground uppercase">
          <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>NO TRACKS IN QUEUE YET</p>
          <p className="text-sm mt-1">SEARCH OR PICK FROM FAVORITES</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tracks.map((track, index) => (
            <div key={track.id} className="flex items-center gap-3">
              {index === 0 ? (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Play className="w-3 h-3 text-primary-foreground fill-current" />
                </div>
              ) : (
                <span className="w-6 text-center text-muted-foreground text-sm flex-shrink-0">
                  {index + 1}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <TrackCard 
                  track={track}
                  showAddedBy
                  userName={getUserName(track.addedBy)}
                  isOwn={track.addedBy === currentUserId}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
