import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';

export function setupSocketIO(io: SocketIOServer, redis: Redis) {
  console.log('[Socket.IO] Setting up Socket.IO handlers');

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);
    
    socket.onAny((eventName, ...args) => {
      console.log(`[Socket.IO] Event received: ${eventName}`, args);
    });

    // Join room
    socket.on('room:join', async ({ roomId, userId }) => {
      console.log(`[Socket.IO] User ${userId} joining room ${roomId}`);
      
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;

      const queueData = await redis.get(`room:${roomId}:queue`);
      const playbackData = await redis.get(`room:${roomId}:playback`);
      const roomData = await redis.get(`room:${roomId}:info`);

      const queue = queueData ? JSON.parse(queueData) : { tracks: [] };
      const playback = playbackData ? JSON.parse(playbackData) : {
        currentTrackId: null,
        position: 0,
        isPlaying: false,
        timestamp: Date.now(),
      };
      const room = roomData ? JSON.parse(roomData) : null;

      socket.emit('queue:state', { tracks: queue.tracks, playbackState: playback });

      if (room && room.spotifyPlaylistId) {
        socket.emit('room:playlist_created', {
          playlistId: room.spotifyPlaylistId,
          playlistUrl: room.spotifyPlaylistUrl,
        });
      }

      socket.to(roomId).emit('room:user_joined', { userId });
    });

    // Leave room
    socket.on('room:leave', ({ roomId, userId }) => {
      console.log(`[Socket.IO] User ${userId} leaving room ${roomId}`);
      
      socket.leave(roomId);
      socket.to(roomId).emit('room:user_left', { userId });
    });

    // Add track to queue
    socket.on('queue:add', async ({ roomId, track }) => {
      console.log(`[Socket.IO] Adding track to room ${roomId}: ${track.name}`);

      const queueData = await redis.get(`room:${roomId}:queue`);
      const queue = queueData ? JSON.parse(queueData) : { tracks: [] };
      
      const wasEmpty = queue.tracks.length === 0;

      queue.tracks.push(track);
      await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

      if (wasEmpty) {
        const newPlayback = {
          currentTrackId: track.id,
          position: 0,
          isPlaying: true,
          timestamp: Date.now(),
        };
        await redis.set(`room:${roomId}:playback`, JSON.stringify(newPlayback));
        
        io.to(roomId).emit('playback:sync', { playbackState: newPlayback });
      }

      io.to(roomId).emit('queue:updated', { tracks: queue.tracks });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      
      if (socket.data.roomId && socket.data.userId) {
        socket.to(socket.data.roomId).emit('room:user_left', { 
          userId: socket.data.userId 
        });
      }
    });
  });
}