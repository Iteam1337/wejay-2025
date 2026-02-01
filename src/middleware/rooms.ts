import Koa from 'koa';
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

let redis: Redis;

export function roomsApiMiddleware(): Koa.Middleware {
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

  return async (ctx, next) => {
    // Get all rooms
    if (ctx.path === '/api/rooms' && ctx.method === 'GET') {
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
        
        ctx.status = 200;
        ctx.body = rooms;
        return;
      } catch (error) {
        console.error('[Rooms API] Get rooms error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to get rooms' };
        return;
      }
    }

    // Get single room by ID
    if (ctx.path.startsWith('/api/rooms/') && ctx.method === 'GET' && !ctx.path.includes('/join') && !ctx.path.includes('/leave') && !ctx.path.includes('/create-playlist')) {
      try {
        const roomId = ctx.path.split('/').pop();
        const roomData = await redis.get(`room:${roomId}:info`);
        
        if (!roomData) {
          ctx.status = 404;
          ctx.body = { error: 'Room not found' };
          return;
        }

        const room = JSON.parse(roomData);
        ctx.status = 200;
        ctx.body = room;
        return;
      } catch (error) {
        console.error('[Rooms API] Get room error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to get room' };
        return;
      }
    }

    // Create room
    if (ctx.path === '/api/rooms' && ctx.method === 'POST') {
      try {
        const { name, createdBy } = ctx.request.body as { name: string; createdBy: string };

        if (!name || !createdBy) {
          ctx.status = 400;
          ctx.body = { error: 'Name and createdBy are required' };
          return;
        }

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
          ctx.status = 200;
          ctx.body = existingRoom;
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

        ctx.status = 201;
        ctx.body = room;
      } catch (error) {
        console.error('[Rooms API] Create room error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to create room' };
      }
      return;
    }

    // Join room
    if (ctx.path.match(/^\/api\/rooms\/[^/]+\/join$/) && ctx.method === 'POST') {
      try {
        const roomId = ctx.path.split('/')[3];
        const { userId } = ctx.request.body as { userId: string };

        if (!userId) {
          ctx.status = 400;
          ctx.body = { error: 'User ID is required' };
          return;
        }

        const roomData = await redis.get(`room:${roomId}:info`);

        if (!roomData) {
          ctx.status = 404;
          ctx.body = { error: 'Room not found' };
          return;
        }

        const room = JSON.parse(roomData);

        // Add user if not already in room
        if (!room.users.includes(userId)) {
          room.users.push(userId);
          await redis.set(`room:${roomId}:info`, JSON.stringify(room));
          console.log(`[Rooms API] User ${userId} joined room ${roomId}`);
        }

        ctx.status = 200;
        ctx.body = room;
      } catch (error) {
        console.error('[Rooms API] Join room error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to join room' };
      }
      return;
    }

    // Create Spotify playlist for room
    if (ctx.path.match(/^\/api\/rooms\/[^/]+\/create-playlist$/) && ctx.method === 'POST') {
      try {
        const roomId = ctx.path.split('/')[3];
        const { accessToken } = ctx.request.body as { accessToken: string };
        
        if (!accessToken) {
          ctx.status = 400;
          ctx.body = { error: 'Access token required' };
          return;
        }

        const roomData = await redis.get(`room:${roomId}:info`);

        if (!roomData) {
          ctx.status = 404;
          ctx.body = { error: 'Room not found' };
          return;
        }

        const room = JSON.parse(roomData);

        // Check if playlist already exists
        if (room.spotifyPlaylistId) {
          ctx.status = 200;
          ctx.body = {
            playlistId: room.spotifyPlaylistId,
            playlistUrl: room.spotifyPlaylistUrl,
            message: 'Playlist already exists',
          };
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
          ctx.status = 401;
          ctx.body = { error: 'Invalid Spotify token' };
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
          ctx.status = 500;
          ctx.body = { error: 'Failed to create Spotify playlist', details: errorText };
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
            const trackUris = queue.tracks.map((t: { spotifyId: string }) => `spotify:track:${t.spotifyId}`);
            
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

        ctx.status = 200;
        ctx.body = {
          playlistId: playlist.id,
          playlistUrl: playlist.external_urls.spotify,
        };
      } catch (error) {
        console.error('[Rooms API] Create playlist error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to create playlist' };
      }
      return;
    }

    // Leave room
    if (ctx.path.match(/^\/api\/rooms\/[^/]+\/leave$/) && ctx.method === 'POST') {
      try {
        const roomId = ctx.path.split('/')[3];
        const { userId } = ctx.request.body as { userId: string };

        if (!userId) {
          ctx.status = 400;
          ctx.body = { error: 'User ID is required' };
          return;
        }

        const roomData = await redis.get(`room:${roomId}:info`);

        if (!roomData) {
          ctx.status = 404;
          ctx.body = { error: 'Room not found' };
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

        ctx.status = 200;
        ctx.body = room;
      } catch (error) {
        console.error('[Rooms API] Leave room error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to leave room' };
      }
      return;
    }

    await next();
  };
}