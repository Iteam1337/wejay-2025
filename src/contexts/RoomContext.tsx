import { createContext, useContext, ReactNode } from 'react';
import { Room, SpotifyUser, Track, PlaylistEntry } from '@/types/wejay';

interface RoomContextValue {
  currentRoom: Room | null;
  roomUsers: SpotifyUser[];
  currentUserId: string;
  isConnected: boolean;
  playlistTracks: Track[];
  arrangedPlaylist: PlaylistEntry[];
  myTracks: PlaylistEntry[];
}

const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  children: ReactNode;
  value: RoomContextValue;
}

export function RoomProvider({ children, value }: RoomProviderProps) {
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}

// Convenience hooks for specific slices
export function useCurrentRoom() {
  const { currentRoom } = useRoom();
  return currentRoom;
}

export function useRoomUsers() {
  const { roomUsers } = useRoom();
  return roomUsers;
}

export function useCurrentUserId() {
  const { currentUserId } = useRoom();
  return currentUserId;
}

export function usePlaylist() {
  const { playlistTracks, arrangedPlaylist, myTracks } = useRoom();
  return { playlistTracks, arrangedPlaylist, myTracks };
}
