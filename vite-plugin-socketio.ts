import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server as HTTPServer } from 'http';
import { Plugin, ViteDevServer } from 'vite';
import Redis from 'ioredis';

interface Track {
  id: string;
  spotifyId: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number;
  addedBy: string;
  addedAt: string;
}

interface PlaybackState {
  currentTrackId: string | null;
  position: number;
  isPlaying: boolean;
  timestamp: number;
}

// Spotify API helper functions
async function createSpotifyPlaylist(
  accessToken: string,
  roomName: string
): Promise<{ id: string; url: string } | null> {
  try {
    // Get user ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userResponse.ok) return null;
    
    const user = await userResponse.json() as { id: string };

    // Create playlist
    const playlistResponse = await fetch(
      `https://api.spotify.com/v1/users/${user.id}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Wejay - ${roomName}`,
          description: `Collaborative playlist for Wejay room "${roomName}". Syncs automatically with the queue!`,
          public: false,
        }),
      }
    );

    if (!playlistResponse.ok) return null;

    const playlist = await playlistResponse.json() as { 
      id: string; 
      external_urls: { spotify: string } 
    };

    return { id: playlist.id, url: playlist.external_urls.spotify };
  } catch (error) {
    console.error('[Socket.IO] Failed to create Spotify playlist:', error);
    return null;
  }
}

async function syncSpotifyPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<boolean> {
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      chunks.push(trackUris.slice(i, i + 100));
    }

    // Replace with first chunk (or clear if empty)
    const replaceResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: chunks[0] || [] }),
      }
    );

    if (!replaceResponse.ok) return false;

    // Add remaining chunks
    for (let i = 1; i < chunks.length; i++) {
      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: chunks[i] }),
      });
    }

    return true;
  } catch (error) {
    console.error('[Socket.IO] Failed to sync Spotify playlist:', error);
    return false;
  }
}



export function socketIoPlugin(): Plugin {
  let io: SocketIOServer;
  let redis: Redis;

  return {
    name: 'socket-io-server',
    configureServer(server: ViteDevServer) {
      if (!server.httpServer) return;

      // Initialize Redis client
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('[Socket.IO] Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      redis.on('connect', () => {
        console.log('[Socket.IO] Connected to Redis');
      });

      redis.on('error', (err) => {
        console.error('[Socket.IO] Redis error:', err);
      });

      // Initialize Socket.IO
      io = new SocketIOServer(server.httpServer as HTTPServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
        path: '/socket.io',
      });

      console.log('[Socket.IO] Server initialized');

      io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);
        
        // Debug: log all incoming events
        socket.onAny((eventName, ...args) => {
          console.log(`[Socket.IO] Event received: ${eventName}`, args);
        });

        // Join room
        socket.on('room:join', async ({ roomId, userId }) => {
          console.log(`[Socket.IO] User ${userId} joining room ${roomId}`);
          
          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.userId = userId;

          // Get current queue, playback state, and room info from Redis
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

          // Send current state to joining user
          socket.emit('queue:state', { tracks: queue.tracks, playbackState: playback });

          // Send room info with Spotify playlist if available
          if (room && room.spotifyPlaylistId) {
            socket.emit('room:playlist_created', {
              playlistId: room.spotifyPlaylistId,
              playlistUrl: room.spotifyPlaylistUrl,
            });
          }

          // Notify others in room
          socket.to(roomId).emit('room:user_joined', { userId });
        });

        // Leave room
        socket.on('room:leave', ({ roomId, userId }) => {
          console.log(`[Socket.IO] User ${userId} leaving room ${roomId}`);
          
          socket.leave(roomId);
          socket.to(roomId).emit('room:user_left', { userId });
        });

        // Manual playlist creation
        socket.on('room:create_playlist', async ({ roomId, accessToken }) => {
          console.log(`[Socket.IO] Manual playlist creation requested for room ${roomId}`);
          
          if (!accessToken) {
            console.error('[Socket.IO] No access token provided');
            return;
          }

          const roomData = await redis.get(`room:${roomId}:info`);
          if (!roomData) {
            console.error(`[Socket.IO] Room ${roomId} not found`);
            return;
          }

          const room = JSON.parse(roomData);
          
          if (room.spotifyPlaylistId) {
            console.log(`[Socket.IO] Playlist already exists: ${room.spotifyPlaylistUrl}`);
            // Re-send to all clients in case they missed it
            io.to(roomId).emit('room:playlist_created', {
              playlistId: room.spotifyPlaylistId,
              playlistUrl: room.spotifyPlaylistUrl,
            });
            return;
          }

          // Create new playlist
          console.log(`[Socket.IO] Creating new Spotify playlist for room ${roomId}`);
          const playlist = await createSpotifyPlaylist(accessToken, room.name);
          
          if (playlist) {
            room.spotifyPlaylistId = playlist.id;
            room.spotifyPlaylistUrl = playlist.url;
            await redis.set(`room:${roomId}:info`, JSON.stringify(room));
            console.log(`[Socket.IO] Created Spotify playlist: ${playlist.url}`);
            
            // Notify all clients
            io.to(roomId).emit('room:playlist_created', {
              playlistId: playlist.id,
              playlistUrl: playlist.url,
            });

            // Sync existing tracks
            const queueData = await redis.get(`room:${roomId}:queue`);
            if (queueData) {
              const queue = JSON.parse(queueData);
              if (queue.tracks && queue.tracks.length > 0) {
                const trackUris = queue.tracks.map((t: Track) => `spotify:track:${t.spotifyId}`);
                await syncSpotifyPlaylist(accessToken, playlist.id, trackUris);
                console.log(`[Socket.IO] Synced ${trackUris.length} existing tracks to new playlist`);
              }
            }
          } else {
            console.error('[Socket.IO] Failed to create Spotify playlist');
          }
        });

        // Add track to queue
        socket.on('queue:add', async ({ roomId, track, accessToken }) => {
          console.log(`[Socket.IO] Adding track to room ${roomId}: ${track.name}`);

          // Get current queue
          const queueData = await redis.get(`room:${roomId}:queue`);
          const queue = queueData ? JSON.parse(queueData) : { tracks: [] };
          
          const wasEmpty = queue.tracks.length === 0;

          // Add track
          queue.tracks.push(track);

          // Save to Redis
          await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

          // If this is the first track, initialize playback state
          if (wasEmpty) {
            const newPlayback = {
              currentTrackId: track.id,
              position: 0,
              isPlaying: true,
              timestamp: Date.now(),
            };
            await redis.set(`room:${roomId}:playback`, JSON.stringify(newPlayback));
            
            // Broadcast playback state to sync all clients
            io.to(roomId).emit('playback:sync', { playbackState: newPlayback });
            console.log(`[Socket.IO] Initialized playback for first track in room ${roomId}`);

            // Create Spotify playlist for this room if it doesn't exist
            if (accessToken) {
              const roomData = await redis.get(`room:${roomId}:info`);
              if (roomData) {
                const room = JSON.parse(roomData);
                if (!room.spotifyPlaylistId) {
                  console.log(`[Socket.IO] Creating Spotify playlist for room ${roomId}`);
                  const playlist = await createSpotifyPlaylist(accessToken, room.name);
                  if (playlist) {
                    room.spotifyPlaylistId = playlist.id;
                    room.spotifyPlaylistUrl = playlist.url;
                    await redis.set(`room:${roomId}:info`, JSON.stringify(room));
                    console.log(`[Socket.IO] Created Spotify playlist: ${playlist.url}`);
                    
                    // Notify all clients about the new playlist
                    io.to(roomId).emit('room:playlist_created', { 
                      playlistId: playlist.id,
                      playlistUrl: playlist.url 
                    });
                  }
                }
              }
            }
          }

          // Auto-sync Spotify playlist if it exists
          if (accessToken) {
            const roomData = await redis.get(`room:${roomId}:info`);
            if (roomData) {
              const room = JSON.parse(roomData);
              if (room.spotifyPlaylistId) {
                const trackUris = queue.tracks.map((t: Track) => `spotify:track:${t.spotifyId}`);
                const synced = await syncSpotifyPlaylist(accessToken, room.spotifyPlaylistId, trackUris);
                if (synced) {
                  console.log(`[Socket.IO] Auto-synced ${trackUris.length} tracks to Spotify playlist`);
                }
              }
            }
          }

          // Broadcast to all in room (including sender)
          io.to(roomId).emit('queue:updated', { tracks: queue.tracks });
        });

        // Remove track from queue
        socket.on('queue:remove', async ({ roomId, trackId, accessToken }) => {
          console.log(`[Socket.IO] Removing track from room ${roomId}: ${trackId}`);

          // Get current queue
          const queueData = await redis.get(`room:${roomId}:queue`);
          const queue = queueData ? JSON.parse(queueData) : { tracks: [] };

          // Remove track
          queue.tracks = queue.tracks.filter((t: Track) => t.id !== trackId);

          // Save to Redis
          await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

          // Auto-sync Spotify playlist if it exists
          if (accessToken) {
            const roomData = await redis.get(`room:${roomId}:info`);
            if (roomData) {
              const room = JSON.parse(roomData);
              if (room.spotifyPlaylistId) {
                const trackUris = queue.tracks.map((t: Track) => `spotify:track:${t.spotifyId}`);
                await syncSpotifyPlaylist(accessToken, room.spotifyPlaylistId, trackUris);
              }
            }
          }

          // Broadcast to all in room
          io.to(roomId).emit('queue:updated', { tracks: queue.tracks });
        });

        // Move track in queue (reorder)
        socket.on('queue:move', async ({ roomId, trackId, userId, direction, accessToken }) => {
          console.log(`[Socket.IO] Moving track ${direction} in room ${roomId}: ${trackId}`);

          // Get current queue
          const queueData = await redis.get(`room:${roomId}:queue`);
          const queue = queueData ? JSON.parse(queueData) : { tracks: [] };

          // Find the track
          const trackIndex = queue.tracks.findIndex((t: Track) => t.id === trackId);

          if (trackIndex === -1 || trackIndex === 0) {
            // Track not found or is currently playing (can't move)
            return;
          }

          const track = queue.tracks[trackIndex];

          // Verify ownership
          if (track.addedBy !== userId) {
            return;
          }

          // Calculate new position
          let newIndex = trackIndex;
          if (direction === 'up') {
            newIndex = Math.max(1, trackIndex - 1);
          } else if (direction === 'down') {
            newIndex = Math.min(queue.tracks.length - 1, trackIndex + 1);
          }

          // Move the track
          if (newIndex !== trackIndex) {
            queue.tracks.splice(trackIndex, 1);
            queue.tracks.splice(newIndex, 0, track);

            // Save to Redis
            await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

            // Auto-sync Spotify playlist if it exists
            if (accessToken) {
              const roomData = await redis.get(`room:${roomId}:info`);
              if (roomData) {
                const room = JSON.parse(roomData);
                if (room.spotifyPlaylistId) {
                  const trackUris = queue.tracks.map((t: Track) => `spotify:track:${t.spotifyId}`);
                  await syncSpotifyPlaylist(accessToken, room.spotifyPlaylistId, trackUris);
                }
              }
            }

            // Broadcast to all in room
            io.to(roomId).emit('queue:updated', { tracks: queue.tracks });
          }
        });

        // Update playback state (play, pause, seek, etc.)
        socket.on('playback:update', async ({ roomId, playbackState }) => {
          console.log(`[Socket.IO] Updating playback for room ${roomId}`, playbackState);

          // Save to Redis
          await redis.set(`room:${roomId}:playback`, JSON.stringify(playbackState));

          // Broadcast to all EXCEPT sender (sender already has this state)
          socket.to(roomId).emit('playback:sync', { playbackState });
        });

        // Track ended - move to next
        socket.on('playback:track_ended', async ({ roomId }) => {
          console.log(`[Socket.IO] Track ended in room ${roomId}`);

          // Get current queue
          const queueData = await redis.get(`room:${roomId}:queue`);
          const queue = queueData ? JSON.parse(queueData) : { tracks: [] };

          if (queue.tracks.length > 0) {
            // Remove first track and track play count
            const finishedTrack = queue.tracks.shift();
            console.log(`[Socket.IO] Removed finished track: ${finishedTrack?.name}`);

            // Save track history with context (weekday, time, etc)
            if (finishedTrack && finishedTrack.addedBy) {
              // Use spotifyId if available, otherwise extract from id
              const originalTrackId = (finishedTrack as any).spotifyId || (() => {
                const lastDashIndex = finishedTrack.id.lastIndexOf('-');
                if (lastDashIndex === -1) return finishedTrack.id;
                const lastPart = finishedTrack.id.substring(lastDashIndex + 1);
                return /^\d+$/.test(lastPart) 
                  ? finishedTrack.id.substring(0, lastDashIndex)
                  : finishedTrack.id;
              })();
              
              // Increment play count for this user in this room
              const playCountKey = `room:${roomId}:user:${finishedTrack.addedBy}:track:${originalTrackId}`;
              await redis.incr(playCountKey);
              await redis.expire(playCountKey, 60 * 60 * 24 * 90);
              
              // Save to history with timestamp and context
              const now = new Date();
              const historyEntry = {
                trackId: originalTrackId,
                trackName: finishedTrack.name,
                artist: finishedTrack.artist,
                timestamp: now.toISOString(),
                weekday: now.getDay(), // 0 = Sunday, 1 = Monday, etc.
                hour: now.getHours(),
                roomId: roomId,
              };
              
              // Add to user's history list in Redis (sorted set by timestamp)
              const historyKey = `room:${roomId}:user:${finishedTrack.addedBy}:history`;
              await redis.zadd(
                historyKey,
                now.getTime(),
                JSON.stringify(historyEntry)
              );
              
              // Keep last 1000 entries (unlimited history but practical limit)
              await redis.zremrangebyrank(historyKey, 0, -1001);
              
              // Set expiry to 1 year
              await redis.expire(historyKey, 60 * 60 * 24 * 365);
              
              console.log(`[Socket.IO] Saved track history for ${originalTrackId} by ${finishedTrack.addedBy} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]} ${now.getHours()}:00)`);
            }

            // Save to Redis
            await redis.set(`room:${roomId}:queue`, JSON.stringify(queue));

            // Update playback state
            const newPlayback = {
              currentTrackId: queue.tracks[0]?.id || null,
              position: 0,
              isPlaying: true,
              timestamp: Date.now(),
            };

            await redis.set(`room:${roomId}:playback`, JSON.stringify(newPlayback));

            // Auto-sync Spotify playlist if it exists (remove finished track)
            const roomData = await redis.get(`room:${roomId}:info`);
            if (roomData) {
              const room = JSON.parse(roomData);
              if (room.spotifyPlaylistId) {
                // Get access token from socket auth or first user's token
                const accessToken = socket.handshake.auth.token;
                if (accessToken) {
                  const trackUris = queue.tracks.map((t: Track) => `spotify:track:${t.spotifyId}`);
                  const synced = await syncSpotifyPlaylist(accessToken, room.spotifyPlaylistId, trackUris);
                  if (synced) {
                    console.log(`[Socket.IO] Auto-synced playlist after track ended (${trackUris.length} tracks remaining)`);
                  }
                }
              }
            }

            // Broadcast to all in room
            io.to(roomId).emit('queue:updated', { tracks: queue.tracks });
            io.to(roomId).emit('playback:sync', { playbackState: newPlayback });
          }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
          console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
          
          if (socket.data.roomId && socket.data.userId) {
            socket.to(socket.data.roomId).emit('room:user_left', { 
              userId: socket.data.userId 
            });
          }
        });
      });
    },
    
    closeBundle() {
      if (redis) {
        redis.disconnect();
      }
    },
  };
}