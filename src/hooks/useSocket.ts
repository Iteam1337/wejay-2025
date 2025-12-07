import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Room, Track, SpotifyUser } from '@/types/wejay';
import { toast } from 'sonner';

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

  // Simulate other users joining/leaving for demo purposes
  useEffect(() => {
    if (!socketState.isConnected || !socketState.currentRoom) return;

    // Mock other users joining after a delay
    const joinTimer = setTimeout(() => {
      const mockUser: SpotifyUser = {
        id: 'mock-user-1',
        display_name: 'Alice Johnson',
        email: 'alice@example.com',
        images: [{ url: '/placeholder.svg' }],
        country: 'SE',
        product: 'premium',
      };

      setSocketState(prev => ({
        ...prev,
        users: [...prev.users, mockUser],
      }));

      toast.success('Alice joined the room', {
        description: 'Say hello to your new collaborator!',
      });
    }, 5000);

    // Mock another user joining
    const joinTimer2 = setTimeout(() => {
      const mockUser: SpotifyUser = {
        id: 'mock-user-2',
        display_name: 'Bob Smith',
        email: 'bob@example.com',
        images: [{ url: '/placeholder.svg' }],
        country: 'SE',
        product: 'premium',
      };

      setSocketState(prev => ({
        ...prev,
        users: [...prev.users, mockUser],
      }));

      toast.success('Bob joined the room', {
        description: 'Another friend is here to share music!',
      });
    }, 10000);

    return () => {
      clearTimeout(joinTimer);
      clearTimeout(joinTimer2);
    };
  }, [socketState.isConnected, socketState.currentRoom]);

  // Room management functions
  const joinRoom = useCallback((roomId: string) => {
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

    toast.success('Joined room successfully', {
      description: `You are now in ${mockRoom.name}`,
    });
  }, [socketState.isConnected, user]);

  const leaveRoom = useCallback(() => {
    if (!socketState.isConnected) return;

    const roomName = socketState.currentRoom?.name;
    
    setSocketState(prev => ({
      ...prev,
      currentRoom: null,
      users: [],
    }));

    if (roomName) {
      toast.info('Left room', {
        description: `You left ${roomName}`,
      });
    }
  }, [socketState.isConnected, socketState.currentRoom]);

  // Simulate user leaving
  const mockUserLeave = useCallback((userId: string) => {
    const user = socketState.users.find(u => u.id === userId);
    if (user) {
      setSocketState(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== userId),
      }));

      toast.info(`${user.display_name} left the room`, {
        description: 'They will be missed!',
      });
    }
  }, [socketState.users]);

  // Queue management functions (mock)
  const addTrack = useCallback((track: Track) => {
    console.log('Mock: Adding track to queue:', track.name);
    
    // Notify others in the room
    if (socketState.currentRoom && socketState.users.length > 1) {
      toast.success(`${track.name} added to queue`, {
        description: `${socketState.users.length - 1} other${socketState.users.length > 2 ? 's' : ''} can see this track`,
      });

      // Simulate other users seeing the track addition
      setTimeout(() => {
        toast.info('Alice liked your track choice', {
          description: 'Great taste in music!',
        });
      }, 2000);
    }
  }, [socketState.currentRoom, socketState.users]);

  const removeTrack = useCallback((trackId: string) => {
    console.log('Mock: Removing track from queue:', trackId);
    
    if (socketState.currentRoom && socketState.users.length > 1) {
      toast.info('Track removed from queue', {
        description: 'The queue has been updated for everyone',
      });
    }
  }, [socketState.currentRoom, socketState.users]);

  // Simulate queue updates from other users
  const simulateQueueUpdate = useCallback((trackName: string, userName: string) => {
    toast.success(`${userName} added "${trackName}" to the queue`, {
      description: 'Check out the updated playlist!',
    });
  }, []);

  // Player control functions (mock)
  const play = useCallback(() => {
    console.log('Mock: Play');
    
    if (socketState.currentRoom && socketState.users.length > 1) {
      toast.info('Playback started', {
        description: 'Everyone in the room can hear this',
      });
    }
  }, [socketState.currentRoom, socketState.users]);

  const pause = useCallback(() => {
    console.log('Mock: Pause');
  }, []);

  const skip = useCallback(() => {
    console.log('Mock: Skip');
  }, []);

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
    mockUserLeave, // Expose for testing/demo purposes
    simulateQueueUpdate, // Expose for testing/demo purposes
  };
}