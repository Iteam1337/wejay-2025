import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Room, Track, SpotifyUser } from '@/types/wejay';

interface SocketState {
  isConnected: boolean;
  currentRoom: Room | null;
  users: SpotifyUser[];
  error: string | null;
}

// Mock socket implementation for development
// In production, replace with actual socket.io-client
export function useSocket() {
  const { user, accessToken } = useAuth();
  const [socketState, setSocketState] = useState<SocketState>({
    isConnected: false,
    currentRoom: null,
    users: [],
    error: null,
  });

  // Mock connection for development
  useEffect(() => {
    if (!user || !accessToken) {
      return;
    }

    // Simulate connection delay
    const connectTimer = setTimeout(() => {
      setSocketState(prev => ({
        ...prev,
        isConnected: true,
        error: null,
      }));
    }, 1000);

    return () => {
      clearTimeout(connectTimer);
    };
  }, [user, accessToken]);

  // Room management functions
  const joinRoom = (roomId: string) => {
    if (!socketState.isConnected) return;

    // Mock room data
    const mockRoom: Room = {
      id: roomId,
      name: `Room ${roomId}`,
      createdBy: user!.id,
      createdAt: new Date(),
      users: [user!],
      isActive: true,
    };

    setSocketState(prev => ({
      ...prev,
      currentRoom: mockRoom,
      users: mockRoom.users,
    }));
  };

  const leaveRoom = () => {
    if (!socketState.isConnected) return;

    setSocketState(prev => ({
      ...prev,
      currentRoom: null,
      users: [],
    }));
  };

  // Queue management functions (mock)
  const addTrack = (track: Track) => {
    console.log('Mock: Adding track to queue:', track.name);
  };

  const removeTrack = (trackId: string) => {
    console.log('Mock: Removing track from queue:', trackId);
  };

  // Player control functions (mock)
  const play = () => {
    console.log('Mock: Play');
  };

  const pause = () => {
    console.log('Mock: Pause');
  };

  const skip = () => {
    console.log('Mock: Skip');
  };

  // Event listeners (mock)
  const on = (event: string, _callback: (...args: any[]) => void) => {
    console.log('Mock: Listening to event:', event);
  };

  const off = (event: string, _callback: (...args: any[]) => void) => {
    console.log('Mock: Stopped listening to event:', event);
  };

  return {
    ...socketState,
    joinRoom,
    leaveRoom,
    addTrack,
    removeTrack,
    play,
    pause,
    skip,
    on,
    off,
  };
}