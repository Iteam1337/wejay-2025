import { useState, useEffect, useCallback, useMemo } from "react";
import { Track, SearchTrack } from "@/types/wejay";
import { arrangeTracks } from "@/lib/dhondt";
import { toast } from "@/lib/toast";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/contexts/AuthContext";

function createTrack(track: SearchTrack, userId: string): Track {
  return {
    ...track,
    id: `${track.id}-${Date.now()}`,
    spotifyId: track.id,
    addedBy: userId,
    addedAt: new Date(),
  };
}

function usePlaylistState() {
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());
  const [myTracksHistory, setMyTracksHistory] = useState<Track[]>([]);

  const addTrackToState = useCallback((newTrack: Track) => {
    setPlaylistTracks((prev) => [...prev, newTrack]);
    setAddedTrackIds((prev) => new Set([...prev, newTrack.spotifyId]));
  }, []);

  const addToHistory = useCallback((newTrack: Track) => {
    setMyTracksHistory((prev) => {
      const originalId = newTrack.spotifyId;
      const filtered = prev.filter((t) => t.id.split("-")[0] !== originalId);
      return [...filtered, newTrack].slice(-20);
    });
  }, []);

  const removeTrackFromState = useCallback((trackId: string) => {
    setPlaylistTracks((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  return {
    playlistTracks,
    setPlaylistTracks,
    addedTrackIds,
    myTracksHistory,
    addTrackToState,
    addToHistory,
    removeTrackFromState,
  };
}

interface PlaylistActionsProps {
  currentUserId: string;
  currentRoomId: string | undefined;
  isConnected: boolean;
  socketAddTrack: (track: Track) => void;
  socketMoveTrack: (trackId: string, userId: string, direction: "up" | "down") => void;
  trackEnded: () => void;
  addTrackToState: (track: Track) => void;
  addToHistory: (track: Track) => void;
  removeTrackFromState: (trackId: string) => void;
  user: ReturnType<typeof useAuth>["user"];
  arrangedPlaylist: Track[];
}

function usePlaylistActions({
  currentUserId,
  currentRoomId,
  isConnected,
  socketAddTrack,
  socketMoveTrack,
  trackEnded,
  addTrackToState,
  addToHistory,
  removeTrackFromState,
  user,
  arrangedPlaylist,
}: PlaylistActionsProps) {
  const handleTrackEnd = useCallback(() => {
    if (arrangedPlaylist.length === 0) return;

    if (isConnected && currentRoomId) {
      trackEnded();
    } else {
      removeTrackFromState(arrangedPlaylist[0].id);
    }

    toast.success("NEXT TRACK", {
      description: arrangedPlaylist[1]?.name || "Queue is empty",
    });
  }, [arrangedPlaylist, isConnected, currentRoomId, trackEnded, removeTrackFromState]);

  const handleAddTrack = useCallback(
    (track: SearchTrack) => {
      const newTrack = createTrack(track, currentUserId);

      addTrackToState(newTrack);
      addToHistory(newTrack);

      if (isConnected && currentRoomId) {
        socketAddTrack(newTrack);
      }

      toast.success(`${track.name} added to queue`, {
        description: currentRoomId ? "Added to room queue" : "Track arranged using D'Hondt method",
      });
    },
    [currentUserId, isConnected, currentRoomId, socketAddTrack, addTrackToState, addToHistory]
  );

  const handleMoveTrack = useCallback(
    (trackId: string, direction: "up" | "down") => {
      if (!currentRoomId || !user) return;
      socketMoveTrack(trackId, user.id, direction);
      toast.success(`Moving track ${direction}...`);
    },
    [currentRoomId, user, socketMoveTrack]
  );

  return { handleTrackEnd, handleAddTrack, handleMoveTrack };
}

export function usePlaylist(currentRoomId: string | undefined) {
  const { user } = useAuth();
  const { tracks: socketTracks, addTrack: socketAddTrack, trackEnded, moveTrack: socketMoveTrack, isConnected } = useSocket();
  const {
    playlistTracks,
    setPlaylistTracks,
    addedTrackIds,
    myTracksHistory,
    addTrackToState,
    addToHistory,
    removeTrackFromState,
  } = usePlaylistState();

  const currentUserId = user?.id || "user-1";

  useEffect(() => {
    setPlaylistTracks(socketTracks);
  }, [socketTracks, setPlaylistTracks]);

  const arrangedPlaylist = useMemo(() => arrangeTracks(playlistTracks), [playlistTracks]);
  const currentTrack = arrangedPlaylist[0] || null;

  const myTracks = useMemo(
    () => arrangedPlaylist.filter((t) => t.addedBy === currentUserId),
    [arrangedPlaylist, currentUserId]
  );

  const { handleTrackEnd, handleAddTrack, handleMoveTrack } = usePlaylistActions({
    currentUserId,
    currentRoomId,
    isConnected,
    socketAddTrack,
    socketMoveTrack,
    trackEnded,
    addTrackToState,
    addToHistory,
    removeTrackFromState,
    user,
    arrangedPlaylist,
  });

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
