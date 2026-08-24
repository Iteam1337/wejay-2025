import { SearchTrack } from "@/types/wejay";

export function formatSearchResults(spotifyResults: Array<{
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
  duration_ms: number;
}>): SearchTrack[] {
  return spotifyResults.map((track) => ({
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArt: track.album.images[0]?.url || "/placeholder.svg",
    duration: Math.floor(track.duration_ms / 1000),
  }));
}
