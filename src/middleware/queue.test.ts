import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ioredis before importing the module
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    zrange: vi.fn(),
    keys: vi.fn(),
  };
  return {
    default: class MockRedis {
      constructor() {
        return mockRedis;
      }
    },
  };
});

import { queueApiMiddleware } from './queue';

describe('Queue API Middleware', () => {
  let middleware: ReturnType<typeof queueApiMiddleware>;
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    zrange: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const Redis = (await import('ioredis')).default;
    const instance = new (Redis as unknown as new () => typeof mockRedis)();
    mockRedis = instance;
    middleware = queueApiMiddleware();
  });

  function createMockContext(method: string, path: string, body?: unknown, params?: Record<string, string>) {
    return {
      method,
      path,
      request: { body },
      params: params || {},
      status: 200,
      body: undefined as unknown,
    } as unknown as import('@koa/router').RouterContext;
  }

  describe('GET /api/rooms/:roomId/history/:userId', () => {
    it('returns user history', async () => {
      const history = [
        { trackId: 'track1', playedAt: '2024-01-01T10:00:00Z' },
        { trackId: 'track2', playedAt: '2024-01-01T11:00:00Z' },
      ];
      mockRedis.zrange.mockResolvedValue(history.map((h) => JSON.stringify(h)));

      const ctx = createMockContext('GET', '/api/rooms/room1/history/user1', undefined, {
        roomId: 'room1',
        userId: 'user1',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual(history);
    });

    it('returns empty array when no history', async () => {
      mockRedis.zrange.mockResolvedValue([]);

      const ctx = createMockContext('GET', '/api/rooms/room1/history/user1', undefined, {
        roomId: 'room1',
        userId: 'user1',
      });
      await middleware(ctx, async () => {});

      expect(ctx.body).toEqual([]);
    });
  });

  describe('GET /api/rooms/:roomId/playcounts/:userId', () => {
    it('returns play counts for user', async () => {
      mockRedis.keys.mockResolvedValue([
        'room:room1:user:user1:track:track1',
        'room:room1:user:user1:track:track2',
      ]);
      mockRedis.get
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('3');

      const ctx = createMockContext('GET', '/api/rooms/room1/playcounts/user1', undefined, {
        roomId: 'room1',
        userId: 'user1',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ track1: 5, track2: 3 });
    });

    it('returns empty object when no play counts', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const ctx = createMockContext('GET', '/api/rooms/room1/playcounts/user1', undefined, {
        roomId: 'room1',
        userId: 'user1',
      });
      await middleware(ctx, async () => {});

      expect(ctx.body).toEqual({});
    });
  });

  describe('POST /api/rooms/:roomId/queue/move', () => {
    it('moves track up in queue', async () => {
      const queue = {
        tracks: [
          { id: 'track1', addedBy: 'user1' },
          { id: 'track2', addedBy: 'user2' },
          { id: 'track3', addedBy: 'user1' },
        ],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(queue));
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms/room1/queue/move', {
        trackId: 'track3',
        userId: 'user1',
        direction: 'up',
      }, { roomId: 'room1' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect((ctx.body as { tracks: Array<{ id: string }> }).tracks[1].id).toBe('track3');
    });

    it('moves track down in queue', async () => {
      const queue = {
        tracks: [
          { id: 'track1', addedBy: 'user1' },
          { id: 'track2', addedBy: 'user1' },
          { id: 'track3', addedBy: 'user2' },
        ],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(queue));
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms/room1/queue/move', {
        trackId: 'track2',
        userId: 'user1',
        direction: 'down',
      }, { roomId: 'room1' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect((ctx.body as { tracks: Array<{ id: string }> }).tracks[2].id).toBe('track2');
    });

    it('returns 400 when trackId is missing', async () => {
      const ctx = createMockContext('POST', '/api/rooms/room1/queue/move', {
        userId: 'user1',
        direction: 'up',
      }, { roomId: 'room1' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Missing trackId' });
    });

    it('returns 404 when track not found', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ tracks: [] }));

      const ctx = createMockContext('POST', '/api/rooms/room1/queue/move', {
        trackId: 'nonexistent',
        userId: 'user1',
        direction: 'up',
      }, { roomId: 'room1' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(404);
      expect(ctx.body).toEqual({ error: 'Track not found' });
    });

    it('returns 403 when moving another user\'s track', async () => {
      const queue = {
        tracks: [{ id: 'track1', addedBy: 'user1' }],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(queue));

      const ctx = createMockContext('POST', '/api/rooms/room1/queue/move', {
        trackId: 'track1',
        userId: 'user2',
        direction: 'up',
      }, { roomId: 'room1' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(403);
      expect(ctx.body).toEqual({ error: 'Can only move your own tracks' });
    });

    it('returns 400 when trying to move currently playing track', async () => {
      const queue = {
        tracks: [
          { id: 'track1', addedBy: 'user1' },
          { id: 'track2', addedBy: 'user1' },
        ],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(queue));

      const ctx = createMockContext('POST', '/api/rooms/room1/queue/move', {
        trackId: 'track1',
        userId: 'user1',
        direction: 'up',
      }, { roomId: 'room1' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Cannot move currently playing track' });
    });

    it('does not move track above position 1', async () => {
      const queue = {
        tracks: [
          { id: 'track1', addedBy: 'user1' },
          { id: 'track2', addedBy: 'user1' },
        ],
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(queue));
      mockRedis.set.mockResolvedValue('OK');

      const ctx = createMockContext('POST', '/api/rooms/room1/queue/move', {
        trackId: 'track2',
        userId: 'user1',
        direction: 'up',
      }, { roomId: 'room1' });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect((ctx.body as { tracks: Array<{ id: string }> }).tracks[0].id).toBe('track1'); // Still first
      expect((ctx.body as { tracks: Array<{ id: string }> }).tracks[1].id).toBe('track2'); // Still second
    });
  });
});
