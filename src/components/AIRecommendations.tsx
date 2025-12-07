import { SearchTrack } from "@/types/wejay";
import { TrackCard } from "./TrackCard";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";

interface AIRecommendationsProps {
  recommendations: SearchTrack[];
  isLoading: boolean;
  error: string | null;
  onAdd: (track: SearchTrack) => void;
  onRefresh: () => void;
  addedTrackIds: Set<string>;
  hasMyTracks: boolean;
}

export function AIRecommendations({
  recommendations,
  isLoading,
  error,
  onAdd,
  onRefresh,
  addedTrackIds,
  hasMyTracks,
}: AIRecommendationsProps) {
  if (!hasMyTracks) {
    return (
      <div className="neumorphic p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-medium text-sm uppercase">AI FOR YOU</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Add some tracks first</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            I'll suggest music based on your taste
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="neumorphic p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-medium text-sm uppercase">AI FOR YOU</h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="neumorphic-button p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          title="Refresh recommendations"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Based on your {recommendations.length > 0 ? 'recent' : ''} additions
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin opacity-50" />
        </div>
      ) : error ? (
        <div className="text-center py-6 text-destructive text-xs">
          <p>{error}</p>
          <button
            onClick={onRefresh}
            className="mt-2 text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No recommendations yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {recommendations.slice(0, 5).map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onAdd={onAdd}
              isAdded={addedTrackIds.has(track.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
