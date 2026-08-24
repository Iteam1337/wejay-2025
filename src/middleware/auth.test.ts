import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authMiddleware } from './auth';

// Set required env vars for tests
process.env.VITE_SPOTIFY_CLIENT_ID = 'test-client-id';
process.env.CLIENT_SECRET = 'test-client-secret';

// Mock fetch
global.fetch = vi.fn();

describe('Auth Middleware', () => {
  let middleware: ReturnType<typeof authMiddleware>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('./auth');
    middleware = module.authMiddleware();
  });

  function createMockContext(method: string, path: string, body?: unknown, cookies?: Record<string, string>) {
    const cookieMap = new Map(Object.entries(cookies || {}));
    return {
      method,
      path,
      request: { body },
      status: 200,
      body: undefined as unknown,
      cookies: {
        get: (name: string) => cookieMap.get(name),
      },
      set: vi.fn(),
    };
  }

  describe('POST /api/auth/store-verifier', () => {
    it('stores a verifier', async () => {
      const ctx = createMockContext('POST', '/api/auth/store-verifier', {
        verifier: 'test-verifier',
        state: 'test-state',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ success: true });
    });

    it('returns 400 when verifier or state is missing', async () => {
      const ctx = createMockContext('POST', '/api/auth/store-verifier', {
        verifier: 'test-verifier',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Missing verifier or state' });
    });
  });

  describe('GET /api/auth/token', () => {
    it('returns access token from cookie', async () => {
      const ctx = createMockContext('GET', '/api/auth/token', undefined, {
        spotify_access_token: 'test-token',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ access_token: 'test-token' });
    });

    it('returns 401 when not authenticated', async () => {
      const ctx = createMockContext('GET', '/api/auth/token');
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(401);
      expect(ctx.body).toEqual({ error: 'Not authenticated' });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears cookies and returns success', async () => {
      const ctx = createMockContext('POST', '/api/auth/logout');
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toEqual({ success: true });
      expect(ctx.set).toHaveBeenCalledWith('Set-Cookie', expect.arrayContaining([
        expect.stringContaining('spotify_access_token=;'),
        expect.stringContaining('Max-Age=0'),
      ]));
    });
  });

  describe('POST /api/auth/exchange-token', () => {
    it('exchanges code for token', async () => {
      // First store a verifier
      const storeCtx = createMockContext('POST', '/api/auth/store-verifier', {
        verifier: 'test-verifier',
        state: 'test-state',
      });
      await middleware(storeCtx, async () => {});
      expect(storeCtx.status).toBe(200);

      // Mock Spotify token exchange
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'spotify-access-token',
          refresh_token: 'spotify-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      // Exchange token
      const exchangeCtx = createMockContext('POST', '/api/auth/exchange-token', {
        code: 'auth-code',
        redirect_uri: 'http://localhost:8080/callback',
        state: 'test-state',
      });
      await middleware(exchangeCtx, async () => {});

      expect(exchangeCtx.status).toBe(200);
      expect(exchangeCtx.body).toMatchObject({
        access_token: 'spotify-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    });

    it('returns 400 when missing parameters', async () => {
      const ctx = createMockContext('POST', '/api/auth/exchange-token', {
        code: 'auth-code',
        // missing redirect_uri and state
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Missing required parameters' });
    });

    it('returns 400 when verifier not found', async () => {
      const ctx = createMockContext('POST', '/api/auth/exchange-token', {
        code: 'auth-code',
        redirect_uri: 'http://localhost:8080/callback',
        state: 'unknown-state',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Verifier not found - please try logging in again' });
    });

    it('handles duplicate exchange gracefully', async () => {
      // Store verifier
      const storeCtx = createMockContext('POST', '/api/auth/store-verifier', {
        verifier: 'test-verifier',
        state: 'test-state',
      });
      await middleware(storeCtx, async () => {});

      // Mock Spotify
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token',
          expires_in: 3600,
        }),
      });

      // First exchange
      const ctx1 = createMockContext('POST', '/api/auth/exchange-token', {
        code: 'code',
        redirect_uri: 'http://localhost/callback',
        state: 'test-state',
      });
      await middleware(ctx1, async () => {});
      expect(ctx1.status).toBe(200);

      // Second exchange (duplicate)
      const ctx2 = createMockContext('POST', '/api/auth/exchange-token', {
        code: 'code',
        redirect_uri: 'http://localhost/callback',
        state: 'test-state',
      });
      await middleware(ctx2, async () => {});

      expect(ctx2.status).toBe(200);
      expect(ctx2.body).toEqual({ error: 'Already processed' });
    });

    it('handles Spotify rejection', async () => {
      // Store verifier
      const storeCtx = createMockContext('POST', '/api/auth/store-verifier', {
        verifier: 'test-verifier',
        state: 'test-state',
      });
      await middleware(storeCtx, async () => {});

      // Mock Spotify failure
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      const ctx = createMockContext('POST', '/api/auth/exchange-token', {
        code: 'bad-code',
        redirect_uri: 'http://localhost/callback',
        state: 'test-state',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: { error: 'invalid_grant' } });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('refreshes access token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      });

      const ctx = createMockContext('POST', '/api/auth/refresh', undefined, {
        spotify_refresh_token: 'old-refresh-token',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(200);
      expect(ctx.body).toMatchObject({
        access_token: 'new-access-token',
        expires_in: 3600,
      });
    });

    it('returns 401 when no refresh token', async () => {
      const ctx = createMockContext('POST', '/api/auth/refresh');
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(401);
      expect(ctx.body).toEqual({ error: 'No refresh token' });
    });

    it('handles Spotify refresh failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      const ctx = createMockContext('POST', '/api/auth/refresh', undefined, {
        spotify_refresh_token: 'invalid-token',
      });
      await middleware(ctx, async () => {});

      expect(ctx.status).toBe(400);
      expect(ctx.body).toEqual({ error: 'Failed to refresh token' });
    });
  });
});
