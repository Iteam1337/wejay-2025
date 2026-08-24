import Router from '@koa/router';
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

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Rooms API] Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    })
  : new Redis({
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

redis.on('connect', () => console.log('[Rooms API] Connected to Redis'));
redis.on('error', (err) => console.error('[Rooms API] Redis error:', err));

async function getRoom(roomId: string): Promise<Room | null> {
  const data = await redis.get(`room:${roomId}:info`);
  return data ? JSON.parse(data) : null;
}

async function saveRoom(room: Room): Promise<void> {
  await redis.set(`room:${room.id}:info`, JSON.stringify(room));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function listRooms(ctx: Router.RouterContext) {
  const keys = await redis.keys('room:*:info');
  const rooms: Room[] = [];

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) rooms.push(JSON.parse(data));
  }

  ctx.body = rooms;
}

async function getRoomById(ctx: Router.RouterContext) {
  const room = await getRoom(ctx.params.id);

  if (!room) {
    ctx.status = 404;
    ctx.body = { error: 'Room not found' };
    return;
  }

  ctx.body = room;
}

async function createRoom(ctx: Router.RouterContext) {
  const { name, createdBy } = ctx.request.body as { name: string; createdBy: string };

  if (!name || !createdBy) {
    ctx.status = 400;
    ctx.body = { error: 'Name and createdBy are required' };
    return;
  }

  const roomId = slugify(name);
  const existing = await getRoom(roomId);

  if (existing) {
    if (!existing.users.includes(createdBy)) {
      existing.users.push(createdBy);
      await saveRoom(existing);
    }
    console.log(`[Rooms API] User joined existing room: ${roomId}`);
    ctx.body = existing;
    return;
  }

  const room: Room = {
    id: roomId,
    name,
    createdBy,
    createdAt: new Date().toISOString(),
    users: [createdBy],
    isActive: true,
  };

  await saveRoom(room);
  console.log(`[Rooms API] Created room: ${roomId} - ${name}`);
  ctx.status = 201;
  ctx.body = room;
}

type MembershipAction = 'join' | 'leave';

async function updateMembership(ctx: Router.RouterContext, action: MembershipAction) {
  const { userId } = ctx.request.body as { userId: string };

  if (!userId) {
    ctx.status = 400;
    ctx.body = { error: 'User ID is required' };
    return;
  }

  const room = await getRoom(ctx.params.id);

  if (!room) {
    ctx.status = 404;
    ctx.body = { error: 'Room not found' };
    return;
  }

  if (action === 'join') {
    if (!room.users.includes(userId)) {
      room.users.push(userId);
      console.log(`[Rooms API] User ${userId} joined room ${room.id}`);
    }
  } else {
    room.users = room.users.filter((u) => u !== userId);
    if (room.users.length === 0) room.isActive = false;
    console.log(`[Rooms API] User ${userId} left room ${room.id}`);
  }

  await saveRoom(room);
  ctx.body = room;
}

const joinRoom = (ctx: Router.RouterContext) => updateMembership(ctx, 'join');
const leaveRoom = (ctx: Router.RouterContext) => updateMembership(ctx, 'leave');

const SPOTIFY_API = 'https://api.spotify.com/v1';

interface SpotifyUser {
  id: string;
}

interface SpotifyPlaylist {
  id: string;
  external_urls: { spotify: string };
}

async function spotifyFetch<T>(accessToken: string, endpoint: string, options?: RequestInit): Promise<T | null> {
  const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Rooms API] Spotify request failed: ${text}`);
    return null;
  }

  return res.json() as Promise<T>;
}

async function fetchSpotifyUser(accessToken: string) {
  return spotifyFetch<SpotifyUser>(accessToken, '/me');
}

async function createSpotifyPlaylist(accessToken: string, userId: string, roomName: string) {
  return spotifyFetch<SpotifyPlaylist>(accessToken, `/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name: `Wejay - ${roomName}`,
      description: `Collaborative playlist for Wejay room "${roomName}". Syncs automatically with the queue!`,
      public: false,
    }),
  });
}

async function syncQueueToPlaylist(accessToken: string, playlistId: string, roomId: string) {
  const queueData = await redis.get(`room:${roomId}:queue`);
  if (!queueData) return;

  const queue = JSON.parse(queueData);
  if (!queue.tracks?.length) return;

  const uris = queue.tracks.map((t: { spotifyId: string }) => `spotify:track:${t.spotifyId}`);

  await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris }),
  });

  console.log(`[Rooms API] Synced ${uris.length} tracks to playlist`);
}

async function createPlaylist(ctx: Router.RouterContext) {
  const { accessToken } = ctx.request.body as { accessToken: string };

  if (!accessToken) {
    ctx.status = 400;
    ctx.body = { error: 'Access token required' };
    return;
  }

  const room = await getRoom(ctx.params.id);

  if (!room) {
    ctx.status = 404;
    ctx.body = { error: 'Room not found' };
    return;
  }

  if (room.spotifyPlaylistId) {
    ctx.body = {
      playlistId: room.spotifyPlaylistId,
      playlistUrl: room.spotifyPlaylistUrl,
      message: 'Playlist already exists',
    };
    return;
  }

  console.log(`[Rooms API] Creating Spotify playlist for room ${room.id}`);

  const user = await fetchSpotifyUser(accessToken);
  if (!user) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid Spotify token' };
    return;
  }

  const playlist = await createSpotifyPlaylist(accessToken, user.id, room.name);
  if (!playlist) {
    ctx.status = 500;
    ctx.body = { error: 'Failed to create Spotify playlist' };
    return;
  }

  room.spotifyPlaylistId = playlist.id;
  room.spotifyPlaylistUrl = playlist.external_urls.spotify;
  await saveRoom(room);

  console.log(`[Rooms API] Created playlist: ${playlist.external_urls.spotify}`);

  await syncQueueToPlaylist(accessToken, playlist.id, room.id);

  ctx.body = {
    playlistId: playlist.id,
    playlistUrl: playlist.external_urls.spotify,
  };
}

export function roomsApiMiddleware(): Router.Middleware {
  const router = new Router({ prefix: '/api/rooms' });

  router.get('/', listRooms);
  router.post('/', createRoom);
  router.get('/:id', getRoomById);
  router.post('/:id/join', joinRoom);
  router.post('/:id/leave', leaveRoom);
  router.post('/:id/create-playlist', createPlaylist);

  return router.routes();
}
