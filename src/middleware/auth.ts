import Koa from 'koa';

interface StoreVerifierRequest {
  verifier: string;
  state: string;
}

interface VerifierData {
  verifier: string;
  timestamp: number;
  used: boolean;
}

// In-memory storage for code verifiers
const verifierStore = new Map<string, VerifierData>();

export function authMiddleware(): Koa.Middleware {
  return async (ctx, next) => {
    // Handle storing verifier before redirect
    if (ctx.path === '/api/auth/store-verifier' && ctx.method === 'POST') {
      try {
        const { verifier, state } = ctx.request.body as StoreVerifierRequest;

        if (!verifier || !state) {
          ctx.status = 400;
          ctx.body = { error: 'Missing verifier or state' };
          return;
        }

        // Store verifier with state as key
        verifierStore.set(state, {
          verifier,
          timestamp: Date.now(),
          used: false,
        });

        console.log(`[Spotify Auth] Stored verifier for state: ${state}`);

        // Clean up old verifiers (older than 10 minutes)
        for (const [key, value] of verifierStore.entries()) {
          if (Date.now() - value.timestamp > 10 * 60 * 1000) {
            verifierStore.delete(key);
          }
        }

        ctx.status = 200;
        ctx.body = { success: true };
        return;
      } catch (error) {
        console.error('[Spotify Auth] Store verifier error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to store verifier' };
        return;
      }
    }

    // Handle token exchange with state
    if (ctx.path === '/api/auth/exchange-token' && ctx.method === 'POST') {
      try {
        const { code, redirect_uri, state } = ctx.request.body as { 
          code: string; 
          redirect_uri: string; 
          state: string; 
        };

        if (!code || !redirect_uri || !state) {
          ctx.status = 400;
          ctx.body = { error: 'Missing required parameters' };
          return;
        }

        console.log(`[Spotify Auth] Exchange token for state: ${state}`);

        // Retrieve verifier from server storage
        const stored = verifierStore.get(state);
        
        if (!stored) {
          console.error(`[Spotify Auth] Verifier not found for state: ${state}`);
          ctx.status = 400;
          ctx.body = { error: 'Verifier not found - please try logging in again' };
          return;
        }

        // Check if already used (prevent double exchange)
        if (stored.used) {
          console.log(`[Spotify Auth] Verifier already used for state: ${state}, ignoring duplicate request`);
          ctx.status = 200;
          ctx.body = { message: 'Already processed' };
          return;
        }

        // Check if expired
        if (Date.now() - stored.timestamp > 10 * 60 * 1000) {
          verifierStore.delete(state);
          ctx.status = 410;
          ctx.body = { error: 'Authentication expired' };
          return;
        }

        const code_verifier = stored.verifier;

        // Mark as used (but don't delete yet, for duplicate detection)
        stored.used = true;
        verifierStore.set(state, stored);
        
        // Schedule deletion after 1 minute
        setTimeout(() => {
          verifierStore.delete(state);
          console.log(`[Spotify Auth] Deleted used verifier for state: ${state}`);
        }, 60 * 1000);

        const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          console.error('[Spotify Auth] Missing credentials');
          ctx.status = 500;
          ctx.body = { error: 'Missing Spotify credentials' };
          return;
        }

        console.log(`[Spotify Auth] Exchanging with Spotify...`);

        // Exchange code for token with Spotify
        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirect_uri,
            code_verifier: code_verifier,
          }),
        });

        const data = await response.json() as { 
          access_token: string; 
          refresh_token: string; 
          expires_in?: number; 
          [key: string]: unknown; 
        };

        if (!response.ok) {
          console.error('[Spotify Auth] Spotify rejected:', data);
          ctx.status = response.status;
          ctx.body = { error: data };
          return;
        }

        console.log('[Spotify Auth] Token exchange successful!');
        
        // Set tokens as httpOnly cookies (more secure than localStorage)
        const accessTokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
        const refreshTokenExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
        
        const cookies = [
          `spotify_access_token=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Expires=${accessTokenExpiry.toUTCString()}`,
          `spotify_refresh_token=${data.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Expires=${refreshTokenExpiry.toUTCString()}`,
          `spotify_token_expiry=${accessTokenExpiry.getTime()}; Path=/; SameSite=Lax; Expires=${accessTokenExpiry.toUTCString()}`
        ];
        
        ctx.set('Set-Cookie', cookies);
        ctx.status = 200;
        ctx.body = { 
          access_token: data.access_token,
          expires_in: data.expires_in,
          token_type: data.token_type
        };
        return;
      } catch (error) {
        console.error('[Spotify Auth] Token exchange error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to exchange token' };
        return;
      }
    }

    // Get current access token from cookie
    if (ctx.path === '/api/auth/token' && ctx.method === 'GET') {
      try {
        const cookies = ctx.cookies;
        const accessToken = cookies.get('spotify_access_token');
        
        if (!accessToken) {
          ctx.status = 401;
          ctx.body = { error: 'Not authenticated' };
          return;
        }

        ctx.status = 200;
        ctx.body = { access_token: accessToken };
      } catch (error) {
        console.error('[Spotify Auth] Get token error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to get token' };
      }
      return;
    }

    // Refresh access token
    if (ctx.path === '/api/auth/refresh' && ctx.method === 'POST') {
      try {
        const cookies = ctx.cookies;
        const refreshToken = cookies.get('spotify_refresh_token');

        if (!refreshToken) {
          ctx.status = 401;
          ctx.body = { error: 'No refresh token' };
          return;
        }

        const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;

        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        const data = await response.json() as { 
          access_token: string; 
          refresh_token?: string; 
          expires_in?: number; 
          [key: string]: unknown; 
        };

        if (!response.ok) {
          console.error('[Spotify Auth] Refresh failed:', data);
          ctx.status = response.status;
          ctx.body = { error: 'Failed to refresh token' };
          return;
        }

        // Set new access token as cookie
        const accessTokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
        
        const cookies_new = [
          `spotify_access_token=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Expires=${accessTokenExpiry.toUTCString()}`,
          `spotify_token_expiry=${accessTokenExpiry.getTime()}; Path=/; SameSite=Lax; Expires=${accessTokenExpiry.toUTCString()}`
        ];
        
        // If new refresh token provided, update it too
        if (data.refresh_token) {
          const refreshTokenExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
          cookies_new.push(`spotify_refresh_token=${data.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Expires=${refreshTokenExpiry.toUTCString()}`);
        }
        
        ctx.set('Set-Cookie', cookies_new);
        ctx.status = 200;
        ctx.body = { 
          access_token: data.access_token,
          expires_in: data.expires_in
        };
      } catch (error) {
        console.error('[Spotify Auth] Refresh error:', error);
        ctx.status = 500;
        ctx.body = { error: 'Failed to refresh token' };
      }
      return;
    }

    // Logout - clear cookies
    if (ctx.path === '/api/auth/logout' && ctx.method === 'POST') {
      const cookies = [
        'spotify_access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        'spotify_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        'spotify_token_expiry=; Path=/; SameSite=Lax; Max-Age=0'
      ];
      
      ctx.set('Set-Cookie', cookies);
      ctx.status = 200;
      ctx.body = { success: true };
      return;
    }

    await next();
  };
}