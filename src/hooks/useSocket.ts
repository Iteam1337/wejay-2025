import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Room, Track, SpotifyUser } from '@/types/wejay';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  isConnected: boolean;
  currentRoom: Room | null;
  users: SpotifyUser[];
  error: string | null;
}

interface PlaybackState {
  currentTrackId: string | null;
  position: number;
  isPlaying: boolean;
  timestamp: number;
}

export function useSocket() {
  const { user, accessToken } = useAuth();
  const [socketState, setSocketState] = useState<SocketState>({
    isConnected: false,
    currentRoom: null,
    users: [],
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentTrackId: null,
    position: 0,
    isPlaying: false,
    timestamp: Date.now(),
  });

  // Initialize socket connection
  useEffect(() => {
    if (!user || !accessToken) {
      return;
    }

    const socket = io({
      path: '/socket.io',
      auth: {
        token: accessToken,
        userId: user.id,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected');
      setSocketState(prev => ({
        ...prev,
        isConnected: true,
        error: null,
      }));
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      setSocketState(prev => ({
        ...prev,
        isConnected: false,
      }));
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.IO] Connection error:', error);
      setSocketState(prev => ({
        ...prev,
        error: 'Failed to connect to server',
      }));
    });

    // Queue events
    socket.on('queue:state', ({ tracks: queueTracks, playbackState: state }) => {
      console.log('[Socket.IO] Received queue state:', queueTracks.length, 'tracks');
      setTracks(queueTracks.map((t: any) => ({
        ...t,
        addedAt: new Date(t.addedAt),
      })));
      setPlaybackState(state);
    });

    socket.on('queue:updated', ({ tracks: queueTracks }) => {
      console.log('[Socket.IO] Queue updated:', queueTracks.length, 'tracks');
      setTracks(queueTracks.map((t: any) => ({
        ...t,
        addedAt: new Date(t.addedAt),
      })));
    });

    // Playback events
    socket.on('playback:sync', ({ playbackState: state }) => {
      console.log('[Socket.IO] Playback synced:', state);
      setPlaybackState(state);
    });

    // Room events
    socket.on('room:playlist_created', ({ playlistId, playlistUrl }) => {
      console.log('[Socket.IO] Room playlist created:', playlistUrl);
      // Update current room with playlist info
      setSocketState(prev => {
        if (!prev.currentRoom) return prev;
        return {
          ...prev,
          currentRoom: {
            ...prev.currentRoom,
            spotifyPlaylistId: playlistId,
            spotifyPlaylistUrl: playlistUrl,
          },
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user, accessToken]);

  // Join room
  const joinRoom = useCallback((roomId: string) => {
    if (!socketRef.current || !user) return;

    console.log('[Socket.IO] Joining room:', roomId);
    socketRef.current.emit('room:join', { roomId, userId: user.id });

    setSocketState(prev => ({
      ...prev,
      currentRoom: {
        id: roomId,
        name: `Room ${roomId}`,
        createdBy: user.id,
        createdAt: new Date(),
        users: [user],
        isActive: true,
      },
    }));
  }, [user]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (!socketRef.current || !socketState.currentRoom || !user) return;

    console.log('[Socket.IO] Leaving room:', socketState.currentRoom.id);
    socketRef.current.emit('room:leave', { 
      roomId: socketState.currentRoom.id, 
      userId: user.id 
    });

    setSocketState(prev => ({
      ...prev,
      currentRoom: null,
    }));
  }, [socketState.currentRoom, user]);

  // Add track
  const addTrack = useCallback((track: Track) => {
    if (!socketRef.current || !socketState.currentRoom) return;

    console.log('[Socket.IO] Adding track:', track.name);
    socketRef.current.emit('queue:add', { 
      roomId: socketState.currentRoom.id, 
      track,
      accessToken: accessToken || undefined
    });
  }, [socketState.currentRoom, accessToken]);

  // Remove track
  const removeTrack = useCallback((trackId: string) => {
    if (!socketRef.current || !socketState.currentRoom) return;

    console.log('[Socket.IO] Removing track:', trackId);
    socketRef.current.emit('queue:remove', {
      roomId: socketState.currentRoom.id,
      trackId,
      accessToken: accessToken || undefined,
    });
  }, [socketState.currentRoom, accessToken]);

  // Update playback state
  const updatePlayback = useCallback((state: PlaybackState) => {
    if (!socketRef.current || !socketState.currentRoom) return;

    console.log('[Socket.IO] Updating playback:', state);
    socketRef.current.emit('playback:update', {
      roomId: socketState.currentRoom.id,
      playbackState: state,
    });
  }, [socketState.currentRoom]);

  // Track ended
  const trackEnded = useCallback(() => {
    console.log('[Socket.IO] trackEnded called');
    console.log('[Socket.IO] socketRef.current:', !!socketRef.current);
    console.log('[Socket.IO] currentRoom:', socketState.currentRoom?.id);
    
    if (!socketRef.current) {
      console.error('[Socket.IO] No socket connection!');
      return;
    }
    
    if (!socketState.currentRoom) {
      console.error('[Socket.IO] No current room!');
      return;
    }

    console.log('[Socket.IO] Emitting playback:track_ended for room:', socketState.currentRoom.id);
    socketRef.current.emit('playback:track_ended', {
      roomId: socketState.currentRoom.id,
    });
  }, [socketState.currentRoom]);

  // Move track in queue
  const moveTrack = useCallback((trackId: string, userId: string, direction: 'up' | 'down') => {
    if (!socketRef.current || !socketState.currentRoom) return;

    console.log('[Socket.IO] Moving track:', trackId, direction);
    socketRef.current.emit('queue:move', {
      roomId: socketState.currentRoom.id,
      trackId,
      userId,
      direction,
      accessToken: accessToken || undefined,
    });
  }, [socketState.currentRoom, accessToken]);

  // Create Spotify playlist manually
  const createPlaylist = useCallback(() => {
    console.log('[useSocket] createPlaylist called');
    console.log('[useSocket] socketRef.current:', !!socketRef.current);
    console.log('[useSocket] currentRoom:', socketState.currentRoom?.id);
    console.log('[useSocket] accessToken:', accessToken ? 'present' : 'missing');
    
    if (!socketRef.current) {
      console.error('[Socket.IO] Cannot create playlist: no socket connection');
      return;
    }
    
    if (!socketState.currentRoom) {
      console.error('[Socket.IO] Cannot create playlist: no room');
      return;
    }
    
    if (!accessToken) {
      console.error('[Socket.IO] Cannot create playlist: no access token');
      return;
    }

    console.log('[Socket.IO] Emitting room:create_playlist event for room:', socketState.currentRoom.id);
    socketRef.current.emit('room:create_playlist', {
      roomId: socketState.currentRoom.id,
      accessToken,
    });
    console.log('[Socket.IO] Event emitted successfully');
  }, [socketState.currentRoom, accessToken]);

  return {
    ...socketState,
    tracks,
    playbackState,
    joinRoom,
    leaveRoom,
    addTrack,
    removeTrack,
    updatePlayback,
    trackEnded,
    moveTrack,
    createPlaylist,
  };
}