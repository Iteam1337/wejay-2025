import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupSocketIO } from './socket-setup';

// Mock socket.io
const mockSocket = {
  id: 'socket-123',
  join: vi.fn(),
  leave: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  onAny: vi.fn(),
  to: vi.fn(() => ({ emit: vi.fn() })),
  data: {},
};

const mockIO = {
  on: vi.fn((event: string, callback: (socket: typeof mockSocket) => void) => {
    if (event === 'connection') {
      callback(mockSocket);
    }
  }),
  to: vi.fn(() => ({ emit: vi.fn() })),
};

// Mock ioredis
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
  };
  return {
    default: class MockRedis {
      constructor() {
        return mockRedis;
      }
    },
  };
});

describe('Socket.IO Setup', () => {
  let mockRedis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const Redis = (await import('ioredis')).default;
    mockRedis = new (Redis as unknown as new () => typeof mockRedis)();
  });

  it('sets up connection handler', () => {
    setupSocketIO(mockIO as never, mockRedis as never);
    expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('registers event handlers on connection', () => {
    setupSocketIO(mockIO as never, mockRedis as never);
    expect(mockSocket.on).toHaveBeenCalledWith('room:join', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('room:leave', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('queue:add', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('handles room:join event', async () => {
    const handlers: Record<string, (data: unknown) => Promise<void>> = {};
    mockSocket.on.mockImplementation((event: string, handler: (data: unknown) => Promise<void>) => {
      handlers[event] = handler;
    });

    setupSocketIO(mockIO as never, mockRedis as never);

    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify({ tracks: [] })) // queue
      .mockResolvedValueOnce(JSON.stringify({ currentTrackId: null })) // playback
      .mockResolvedValueOnce(JSON.stringify({ spotifyPlaylistId: 'playlist-123' })); // room

    await handlers['room:join']({ roomId: 'test-room', userId: 'user-1' });

    expect(mockSocket.join).toHaveBeenCalledWith('test-room');
    expect((mockSocket.data as { roomId: string }).roomId).toBe('test-room');
    expect((mockSocket.data as { userId: string }).userId).toBe('user-1');
    expect(mockSocket.emit).toHaveBeenCalledWith('queue:state', expect.objectContaining({ tracks: [] }));
  });

  it('handles room:leave event', () => {
    const handlers: Record<string, (data: unknown) => void> = {};
    mockSocket.on.mockImplementation((event: string, handler: (data: unknown) => void) => {
      handlers[event] = handler;
    });

    setupSocketIO(mockIO as never, mockRedis as never);

    handlers['room:leave']({ roomId: 'test-room', userId: 'user-1' });

    expect(mockSocket.leave).toHaveBeenCalledWith('test-room');
  });

  it('handles queue:add event', async () => {
    const handlers: Record<string, (data: unknown) => Promise<void>> = {};
    mockSocket.on.mockImplementation((event: string, handler: (data: unknown) => Promise<void>) => {
      handlers[event] = handler;
    });

    setupSocketIO(mockIO as never, mockRedis as never);

    mockRedis.get.mockResolvedValue(JSON.stringify({ tracks: [] }));
    mockRedis.set.mockResolvedValue('OK');

    const track = { id: 'track-1', name: 'Test Track' };
    await handlers['queue:add']({ roomId: 'test-room', track });

    expect(mockRedis.set).toHaveBeenCalledWith(
      'room:test-room:queue',
      JSON.stringify({ tracks: [track] })
    );
  });

  it('handles disconnect event', () => {
    const handlers: Record<string, () => void> = {};
    mockSocket.on.mockImplementation((event: string, handler: () => void) => {
      handlers[event] = handler;
    });

    setupSocketIO(mockIO as never, mockRedis as never);

    (mockSocket.data as { roomId: string }).roomId = 'test-room';
    (mockSocket.data as { userId: string }).userId = 'user-1';

    handlers['disconnect']();

    // Should emit room:user_left
    expect(mockSocket.to).toHaveBeenCalledWith('test-room');
  });
});
