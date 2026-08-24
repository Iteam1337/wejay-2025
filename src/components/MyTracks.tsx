import { PlaylistEntry } from "@/types/wejay";

interface MyTracksProps {
  tracks: PlaylistEntry[];
}

export function MyTracks({ tracks }: MyTracksProps) {
  if (tracks.length === 0) return null;

  return (
    <div className="neumorphic p-4">
      <h3 className="font-medium text-sm mb-3 flex items-center gap-2 uppercase">
        <span className="text-primary">YOUR TRACKS</span>
        <span className="text-muted-foreground">({tracks.length})</span>
      </h3>
      <div className="space-y-2">
        {tracks.slice(0, 3).map((track) => (
          <div key={track.id} className="flex items-center gap-2 text-sm">
            <img
              src={track.albumArt}
              alt={track.album}
              className="w-8 h-8 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground">{track.name}</p>
              <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
            </div>
            <span className="text-xs text-muted-foreground">#{track.position}</span>
          </div>
        ))}
        {tracks.length > 3 && (
          <p className="text-xs text-muted-foreground text-center pt-1 uppercase">
            +{tracks.length - 3} MORE
          </p>
        )}
      </div>
    </div>
  );
}
