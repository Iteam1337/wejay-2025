import { Plugin } from 'vite';
import Redis from 'ioredis';

interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  users: string[];
  isActive: boolean;
  spotifyPlaylistId?: string;
  spotifyPlaylistUrl?: string;
}

export function roomsApiPlugin(): Plugin {
  let redis: Redis;

  return {
    name: 'rooms-api-middleware',
    configureServer(server) {
      // Initialize Redis client
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('[Rooms API] Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      redis.on('connect', () => {
        console.log('[Rooms API] Connected to Redis');
      });

      redis.on('error', (err) => {
        console.error('[Rooms API] Redis error:', err);
      });

      server.middlewares.use(async (req, res, next) => {
        // Get all rooms
        if (req.url === '/api/rooms' && req.method === 'GET') {
          try {
            // Get all room keys from Redis
            const keys = await redis.keys('room:*:info');
            const rooms: Room[] = [];
            
            for (const key of keys) {
              const roomData = await redis.get(key);
              if (roomData) {
                rooms.push(JSON.parse(roomData));
              }
            }
            
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rooms));
            return;
          } catch (error) {
            console.error('[Rooms API] Get rooms error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to get rooms' }));
            return;
          }
        }

        // Get single room by ID
        if (req.url?.startsWith('/api/rooms/') && req.method === 'GET') {
          try {
            const roomId = req.url.split('/').pop();
            const roomData = await redis.get(`room:${roomId}:info`);
            
            if (!roomData) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Room not found' }));
              return;
            }

            const room = JSON.parse(roomData);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(room));
            return;
          } catch (error) {
            console.error('[Rooms API] Get room error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to get room' }));
            return;
          }
        }

        // Create room
        if (req.url === '/api/rooms' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { name, createdBy } = JSON.parse(body);

                // Use room name as ID (slugified)
                const roomId = name
                  .toLowerCase()
                  .trim()
                  .replace(/[^\w\s-]/g, '') // Remove special chars
                  .replace(/\s+/g, '-')      // Replace spaces with dashes
                  .replace(/-+/g, '-');      // Remove duplicate dashes

                // Check if room already exists
                const existingRoomData = await redis.get(`room:${roomId}:info`);
                
                if (existingRoomData) {
                  const existingRoom = JSON.parse(existingRoomData);
                  // Room exists, just add user to it
                  if (!existingRoom.users.includes(createdBy)) {
                    existingRoom.users.push(createdBy);
                    await redis.set(`room:${roomId}:info`, JSON.stringify(existingRoom));
                  }
                  console.log(`[Rooms API] User joined existing room: ${roomId}`);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(existingRoom));
                  return;
                }

                // Create new room
                const room: Room = {
                  id: roomId,
                  name,
                  createdBy,
                  createdAt: new Date().toISOString(),
                  users: [createdBy],
                  isActive: true,
                };

                await redis.set(`room:${roomId}:info`, JSON.stringify(room));
                console.log(`[Rooms API] Created room: ${roomId} - ${name}`);

                res.statusCode = 201;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(room));
              } catch (error) {
                console.error('[Rooms API] Create room error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to create room' }));
              }
            });

            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process request' }));
            return;
          }
        }

        // Join room
        if (req.url?.startsWith('/api/rooms/') && req.url?.endsWith('/join') && req.method === 'POST') {
          try {
            const roomId = req.url.split('/')[3];
            
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { userId } = JSON.parse(body);
                const roomData = await redis.get(`room:${roomId}:info`);

                if (!roomData) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: 'Room not found' }));
                  return;
                }

                const room = JSON.parse(roomData);

                // Add user if not already in room
                if (!room.users.includes(userId)) {
                  room.users.push(userId);
                  await redis.set(`room:${roomId}:info`, JSON.stringify(room));
                  console.log(`[Rooms API] User ${userId} joined room ${roomId}`);
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(room));
              } catch (error) {
                console.error('[Rooms API] Join room error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to join room' }));
              }
            });

            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process request' }));
            return;
          }
        }

        // Create Spotify playlist for room
        if (req.url?.startsWith('/api/rooms/') && req.url?.endsWith('/create-playlist') && req.method === 'POST') {
          try {
            const roomId = req.url.split('/')[3];
            
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { accessToken } = JSON.parse(body);
                
                if (!accessToken) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Access token required' }));
                  return;
                }

                const roomData = await redis.get(`room:${roomId}:info`);

                if (!roomData) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: 'Room not found' }));
                  return;
                }

                const room = JSON.parse(roomData);

                // Check if playlist already exists
                if (room.spotifyPlaylistId) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    playlistId: room.spotifyPlaylistId,
                    playlistUrl: room.spotifyPlaylistUrl,
                    message: 'Playlist already exists',
                  }));
                  return;
                }

                // Create Spotify playlist
                console.log(`[Rooms API] Creating Spotify playlist for room ${roomId}`);
                
                // Get user ID
                console.log(`[Rooms API] Fetching Spotify user info...`);
                const userResponse = await fetch('https://api.spotify.com/v1/me', {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                
                console.log(`[Rooms API] User response status: ${userResponse.status}`);
                
                if (!userResponse.ok) {
                  const errorText = await userResponse.text();
                  console.error(`[Rooms API] Failed to get Spotify user: ${errorText}`);
                  res.statusCode = 401;
                  res.end(JSON.stringify({ error: 'Invalid Spotify token' }));
                  return;
                }
                
                const user = await userResponse.json() as { id: string };
                console.log(`[Rooms API] Spotify user ID: ${user.id}`);

                // Create playlist
                console.log(`[Rooms API] Creating playlist for user ${user.id}...`);
                const playlistResponse = await fetch(
                  `https://api.spotify.com/v1/users/${user.id}/playlists`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      name: `Wejay - ${room.name}`,
                      description: `Collaborative playlist for Wejay room "${room.name}". Syncs automatically with the queue!`,
                      public: false,
                    }),
                  }
                );

                console.log(`[Rooms API] Playlist creation response status: ${playlistResponse.status}`);

                if (!playlistResponse.ok) {
                  const errorText = await playlistResponse.text();
                  console.error(`[Rooms API] Failed to create playlist: ${errorText}`);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to create Spotify playlist', details: errorText }));
                  return;
                }

                const playlist = await playlistResponse.json() as { 
                  id: string; 
                  external_urls: { spotify: string } 
                };

                // Save to room
                room.spotifyPlaylistId = playlist.id;
                room.spotifyPlaylistUrl = playlist.external_urls.spotify;
                await redis.set(`room:${roomId}:info`, JSON.stringify(room));

                console.log(`[Rooms API] Created Spotify playlist: ${playlist.external_urls.spotify}`);

                // Sync existing tracks if any
                const queueData = await redis.get(`room:${roomId}:queue`);
                if (queueData) {
                  const queue = JSON.parse(queueData);
                  if (queue.tracks && queue.tracks.length > 0) {
                    const trackUris = queue.tracks.map((t: any) => `spotify:track:${t.spotifyId}`);
                    
                    await fetch(
                      `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
                      {
                        method: 'PUT',
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ uris: trackUris }),
                      }
                    );
                    
                    console.log(`[Rooms API] Synced ${trackUris.length} tracks to new playlist`);
                  }
                }

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  playlistId: playlist.id,
                  playlistUrl: playlist.external_urls.spotify,
                }));
              } catch (error) {
                console.error('[Rooms API] Create playlist error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to create playlist' }));
              }
            });

            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process request' }));
            return;
          }
        }

        // Leave room
        if (req.url?.startsWith('/api/rooms/') && req.url?.endsWith('/leave') && req.method === 'POST') {
          try {
            const roomId = req.url.split('/')[3];
            
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { userId } = JSON.parse(body);
                const roomData = await redis.get(`room:${roomId}:info`);

                if (!roomData) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: 'Room not found' }));
                  return;
                }

                const room = JSON.parse(roomData);

                // Remove user from room
                room.users = room.users.filter((u: string) => u !== userId);
                
                // Mark room as inactive if no users left
                if (room.users.length === 0) {
                  room.isActive = false;
                }

                await redis.set(`room:${roomId}:info`, JSON.stringify(room));
                console.log(`[Rooms API] User ${userId} left room ${roomId}`);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(room));
              } catch (error) {
                console.error('[Rooms API] Leave room error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to leave room' }));
              }
            });

            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process request' }));
            return;
          }
        }

        next();
      });
    },
  };
}