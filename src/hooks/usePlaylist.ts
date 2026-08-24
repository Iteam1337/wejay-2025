import { useState, useEffect, useCallback, useMemo } from "react";
import { Track, SearchTrack } from "@/types/wejay";
import { arrangeTracks } from "@/lib/dhondt";
import { toast } from "@/lib/toast";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";

export function usePlaylist(currentRoomId: string | undefined) {
  const { user } = useAuth();
  const { tracks: socketTracks, addTrack: socketAddTrack, trackEnded, moveTrack: socketMoveTrack, isConnected } = useSocket();
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());
  const [myTracksHistory, setMyTracksHistory] = useState<Track[]>([]);

  const currentUserId = user?.id || "user-1";

  useEffect(() => {
    setPlaylistTracks(socketTracks);
  }, [socketTracks]);

  const arrangedPlaylist = useMemo(() => arrangeTracks(playlistTracks), [playlistTracks]);
  const currentTrack = arrangedPlaylist[0] || null;

  const myTracks = useMemo(
    () => arrangedPlaylist.filter((t) => t.addedBy === currentUserId),
    [arrangedPlaylist, currentUserId]
  );

  const handleTrackEnd = useCallback(() => {
    if (arrangedPlaylist.length === 0) return;

    if (isConnected && currentRoomId) {
      trackEnded();
    } else {
      setPlaylistTracks((prev) => prev.filter((t) => t.id !== arrangedPlaylist[0]?.id));
    }

    toast.success("NEXT TRACK", {
      description: arrangedPlaylist[1]?.name || "Queue is empty",
    });
  }, [arrangedPlaylist, isConnected, currentRoomId, trackEnded]);

  const handleAddTrack = useCallback(
    (track: SearchTrack) => {
      const newTrack: Track = {
        ...track,
        id: `${track.id}-${Date.now()}`,
        spotifyId: track.id,
        addedBy: currentUserId,
        addedAt: new Date(),
      };

      setPlaylistTracks((prev) => [...prev, newTrack]);
      setAddedTrackIds((prev) => new Set([...prev, track.id]));

      setMyTracksHistory((prev) => {
        const originalId = track.id;
        const filtered = prev.filter((t) => t.id.split("-")[0] !== originalId);
        return [...filtered, newTrack].slice(-20);
      });

      if (isConnected && currentRoomId) {
        socketAddTrack(newTrack);
      }

      toast.success(`${track.name} added to queue`, {
        description: currentRoomId ? "Added to room queue" : "Track arranged using D'Hondt method",
      });
    },
    [currentUserId, isConnected, currentRoomId, socketAddTrack]
  );

  const handleMoveTrack = useCallback(
    (trackId: string, direction: "up" | "down") => {
      if (!currentRoomId || !user) return;
      socketMoveTrack(trackId, user.id, direction);
      toast.success(`Moving track ${direction}...`);
    },
    [currentRoomId, user, socketMoveTrack]
  );

  return {
    playlistTracks,
    arrangedPlaylist,
    currentTrack,
    myTracks,
    myTracksHistory,
    addedTrackIds,
    handleTrackEnd,
    handleAddTrack,
    handleMoveTrack,
  };
}
