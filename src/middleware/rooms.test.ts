import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ioredis before importing the module
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    keys: vi.fn(),
    on: vi.fn(),
  };
  return {
    default: class MockRedis {
      constructor() {
        return mockRedis;
      }
    },
  };
});

import { roomsApiMiddleware } from './rooms';

// Mock fetch
global.fetch = vi.fn();

describe('Rooms API Middleware', () => {
  let middleware: ReturnType<typeof roomsApiMiddleware>;
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mock from the module's redis instance
    const Redis = (await import('ioredis')).default;
    const instance = new (Redis as unknown as new () => typeof mockRedis)();
    mockRedis = instance;
    middleware = roomsApiMiddleware();
  });

  function createMockContext(method: string, path: string, body?: unknown, params?: Record<string, string>) {
    return {
      method,
      path,
      request: { body },
      params: params || {},
      status: 200,
      body: undefined as unknown,
      set: vi.fn(),
    };
  }

  describe('GET /api/rooms', () => {
    it('returns all rooms', async () => {
      const rooms = [
        { id: 'room1', name: 'Room 1', users: ['user1'] },
        { id: 'room2', name: 'Room 2', users: ['user2'] },
      ];

      mockRedis.keys.mockResolvedValue(['room:room1:info', 'room:room2:info']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(rooms[0]))
        .mockResolvedValueOnce(JSON.stringify(rooms[1]));

      const ctx = createMockContext('GET', '/api/rooms');
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual(rooms);
    });

    it('returns empty array when no rooms exist', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const ctx = createMockContext('GET', '/api/rooms');
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual([]);
    });
  });

  describe('POST /api/rooms', () => {
    it('creates a new room', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms', {
        name: 'Test Room',
        createdBy: 'user1',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(201);
      expect(ctx.body).toMatchObject({
        id: 'test-room',
        name: 'Test Room',
        createdBy: 'user1',
        users: ['user1'],
        isActive: true,
      });
    });

    it('returns 400 when name or createdBy is missing', async () => {
      const ctx = createMockContext('POST', '/api/rooms', { name: 'Test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Name and createdBy are required' });
    });

    it('joins existing room if it already exists', async () => {
      const existingRoom = {
        id: 'test-room',
        name: 'Test Room',
        createdBy: 'user1',
        users: ['user1'],
        isActive: true,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(existingRoom));
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms', {
        name: 'Test Room',
        createdBy: 'user2',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body.users).toContain('user2');
    });
  });

  describe('GET /api/rooms/:id', () => {
    it('returns a room by id', async () => {
      const room = { id: 'test', name: 'Test Room', users: ['user1'] };
      mockRedis.get.mockResolvedValue(JSON.stringify(room));

      const ctx = createMockContext('GET', '/api/rooms/test', undefined, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual(room);
    });

    it('returns 404 when room not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const ctx = createMockContext('GET', '/api/rooms/nonexistent', undefined, { id: 'nonexistent' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(404);
      expect(ctx.body).toEqual({ error: 'Room not found' });
    });
  });

  describe('POST /api/rooms/:id/join', () => {
    it('adds user to room', async () => {
      const room = { id: 'test', name: 'Test', users: ['user1'], isActive: true };
      mockRedis.get.mockResolvedValue(JSON.stringify(room));
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms/test/join', { userId: 'user2' }, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body.users).toContain('user2');
    });

    it('returns 400 when userId is missing', async () => {
      const ctx = createMockContext('POST', '/api/rooms/test/join', {}, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'User ID is required' });
    });

    it('returns 404 when room not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const ctx = createMockContext('POST', '/api/rooms/test/join', { userId: 'user2' }, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(404);
    });
  });

  describe('POST /api/rooms/:id/leave', () => {
    it('removes user from room', async () => {
      const room = { id: 'test', name: 'Test', users: ['user1', 'user2'], isActive: true };
      mockRedis.get.mockResolvedValue(JSON.stringify(room));
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms/test/leave', { userId: 'user2' }, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body.users).not.toContain('user2');
      expect(ctx.body.isActive).toBe(true);
    });

    it('marks room as inactive when last user leaves', async () => {
      const room = { id: 'test', name: 'Test', users: ['user1'], isActive: true };
      mockRedis.get.mockResolvedValue(JSON.stringify(room));
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms/test/leave', { userId: 'user1' }, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.body.isActive).toBe(false);
    });
  });

  describe('POST /api/rooms/:id/create-playlist', () => {
    it('creates a Spotify playlist', async () => {
      const room = { id: 'test', name: 'Test Room', users: ['user1'] };
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(room)) // getRoom
        .mockResolvedValueOnce(JSON.stringify({ tracks: [] })); // getQueue
      mockRedis.set.mockResolvedValue('OK');

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'spotify-user-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'playlist-id',
            external_urls: { spotify: 'https://open.spotify.com/playlist/123' },
          }),
        })
        .mockResolvedValueOnce({ ok: true }); // sync tracks

      const ctx = createMockContext('POST', '/api/rooms/test/create-playlist', { accessToken: 'token123' }, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({
        playlistId: 'playlist-id',
        playlistUrl: 'https://open.spotify.com/playlist/123',
      });
    });

    it('returns existing playlist if already created', async () => {
      const room = {
        id: 'test',
        name: 'Test Room',
        users: ['user1'],
        spotifyPlaylistId: 'existing-id',
        spotifyPlaylistUrl: 'https://open.spotify.com/playlist/existing',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(room));

      const ctx = createMockContext('POST', '/api/rooms/test/create-playlist', { accessToken: 'token123' }, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.body).toMatchObject({
        playlistId: 'existing-id',
        message: 'Playlist already exists',
      });
    });

    it('returns 400 when accessToken is missing', async () => {
      const ctx = createMockContext('POST', '/api/rooms/test/create-playlist', {}, { id: 'test' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Access token required' });
    });
  });
});
