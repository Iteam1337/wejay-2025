import { Server as SocketIOServer, Socket } from 'socket.io';
import Redis from 'ioredis';

interface PlaybackState {
  currentTrackId: string | null;
  position: number;
  isPlaying: boolean;
  timestamp: number;
}

interface Queue {
  tracks: unknown[];
}

interface Room {
  spotifyPlaylistId?: string;
  spotifyPlaylistUrl?: string;
}

const DEFAULT_PLAYBACK: PlaybackState = {
  currentTrackId: null,
  position: 0,
  isPlaying: false,
  timestamp: Date.now(),
};

async function getRoomState(redis: Redis, roomId: string) {
  const [queueData, playbackData, roomData] = await Promise.all([
    redis.get(`room:${roomId}:queue`),
    redis.get(`room:${roomId}:playback`),
    redis.get(`room:${roomId}:info`),
  ]);

  return {
    queue: queueData ? (JSON.parse(queueData) as Queue) : { tracks: [] },
    playback: playbackData ? (JSON.parse(playbackData) as PlaybackState) : { ...DEFAULT_PLAYBACK, timestamp: Date.now() },
    room: roomData ? (JSON.parse(roomData) as Room) : null,
  };
}

async function handleJoinRoom(_io: SocketIOServer, socket: Socket, redis: Redis, { roomId, userId }: { roomId: string; userId: string }) {
  console.log(`[Socket.IO] User ${userId} joining room ${roomId}`);

  await socket.join(roomId);
  socket.data.roomId = roomId;
  socket.data.userId = userId;

  const { queue, playback, room } = await getRoomState(redis, roomId);

  socket.emit('queue:state', { tracks: queue.tracks, playbackState: playback });

  if (room?.spotifyPlaylistId) {
    socket.emit('room:playlist_created', {
      playlistId: room.spotifyPlaylistId,
      playlistUrl: room.spotifyPlaylistUrl,
    });
  }

  socket.to(roomId).emit('room:user_joined', { userId });
}

function handleLeaveRoom(socket: Socket, { roomId, userId }: { roomId: string; userId: string }) {
  console.log(`[Socket.IO] User ${userId} leaving room ${roomId}`);

  socket.leave(roomId);
  socket.to(roomId).emit('room:user_left', { userId });
}

async function handleAddTrack(io: SocketIOServer, redis: Redis, { roomId, track }: { roomId: string; track: { id: string; name: string } }) {
  console.log(`[Socket.IO] Adding track to room ${roomId}: ${track.name}`);

  const queueData = await redis.get(`room:${roomId}:queue`);
  const queue: Queue = queueData ? JSON.parse(queueData) : { tracks: [] };

  const wasEmpty = queue.tracks.length === 0;
  queue.tracks.push(track);
  await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

  if (wasEmpty) {
    const newPlayback: PlaybackState = {
      currentTrackId: track.id,
      position: 0,
      isPlaying: true,
      timestamp: Date.now(),
    };
    await redis.set(`room:${roomId}:playback`, JSON.stringify(newPlayback));
    io.to(roomId).emit('playback:sync', { playbackState: newPlayback });
  }

  io.to(roomId).emit('queue:updated', { tracks: queue.tracks });
}

function handleDisconnect(socket: Socket) {
  console.log(`[Socket.IO] Client disconnected: ${socket.id}`);

  if (socket.data.roomId && socket.data.userId) {
    socket.to(socket.data.roomId).emit('room:user_left', {
      userId: socket.data.userId,
    });
  }
}

export function setupSocketIO(io: SocketIOServer, redis: Redis) {
  console.log('[Socket.IO] Setting up Socket.IO handlers');

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.onAny((eventName, ...args) => {
      console.log(`[Socket.IO] Event received: ${eventName}`, args);
    });

    socket.on('room:join', (data) => handleJoinRoom(io, socket, redis, data));
    socket.on('room:leave', (data) => handleLeaveRoom(socket, data));
    socket.on('queue:add', (data) => handleAddTrack(io, redis, data));
    socket.on('disconnect', () => handleDisconnect(socket));
  });
}
