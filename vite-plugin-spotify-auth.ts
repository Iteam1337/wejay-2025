import { Plugin } from 'vite';

interface TokenExchangeRequest {
  code: string;
  redirect_uri: string;
  code_verifier: string;
}

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

export function spotifyAuthPlugin(): Plugin {
  return {
    name: 'spotify-auth-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Handle storing verifier before redirect
        if (req.url === '/api/auth/store-verifier' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { verifier, state } = JSON.parse(body) as StoreVerifierRequest;

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

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (error) {
                console.error('[Spotify Auth] Store verifier error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to store verifier' }));
              }
            });

            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process request' }));
            return;
          }
        }

        // Handle token exchange with state
        if (req.url?.startsWith('/api/auth/exchange-token') && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });

            req.on('end', async () => {
              try {
                const { code, redirect_uri, state } = JSON.parse(body) as any;

                console.log(`[Spotify Auth] Exchange token for state: ${state}`);

                // Retrieve verifier from server storage
                const stored = verifierStore.get(state);
                
                if (!stored) {
                  console.error(`[Spotify Auth] Verifier not found for state: ${state}`);
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Verifier not found - please try logging in again' }));
                  return;
                }

                // Check if already used (prevent double exchange)
                if (stored.used) {
                  console.log(`[Spotify Auth] Verifier already used for state: ${state}, ignoring duplicate request`);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ message: 'Already processed' }));
                  return;
                }

                // Check if expired
                if (Date.now() - stored.timestamp > 10 * 60 * 1000) {
                  verifierStore.delete(state);
                  res.statusCode = 410;
                  res.end(JSON.stringify({ error: 'Authentication expired' }));
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
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Missing Spotify credentials' }));
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

                const data = await response.json() as any;

                if (!response.ok) {
                  console.error('[Spotify Auth] Spotify rejected:', data);
                  res.statusCode = response.status;
                  res.end(JSON.stringify({ error: data }));
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
                
                res.setHeader('Set-Cookie', cookies);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                  access_token: data.access_token,
                  expires_in: data.expires_in,
                  token_type: data.token_type
                }));
              } catch (error) {
                console.error('[Spotify Auth] Token exchange error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to exchange token' }));
              }
            });

            return;
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to process request' }));
            return;
          }
        }

        // Get current access token from cookie
        if (req.url === '/api/auth/token' && req.method === 'GET') {
          try {
            const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
              const [key, value] = cookie.trim().split('=');
              acc[key] = value;
              return acc;
            }, {} as Record<string, string>) || {};

            const accessToken = cookies['spotify_access_token'];
            
            if (!accessToken) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: 'Not authenticated' }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ access_token: accessToken }));
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to get token' }));
          }
          return;
        }

        // Refresh access token
        if (req.url === '/api/auth/refresh' && req.method === 'POST') {
          try {
            const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
              const [key, value] = cookie.trim().split('=');
              acc[key] = value;
              return acc;
            }, {} as Record<string, string>) || {};

            const refreshToken = cookies['spotify_refresh_token'];

            if (!refreshToken) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: 'No refresh token' }));
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

            const data = await response.json() as any;

            if (!response.ok) {
              console.error('[Spotify Auth] Refresh failed:', data);
              res.statusCode = response.status;
              res.end(JSON.stringify({ error: 'Failed to refresh token' }));
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
            
            res.setHeader('Set-Cookie', cookies_new);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              access_token: data.access_token,
              expires_in: data.expires_in
            }));
          } catch (error) {
            console.error('[Spotify Auth] Refresh error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to refresh token' }));
          }
          return;
        }

        // Logout - clear cookies
        if (req.url === '/api/auth/logout' && req.method === 'POST') {
          const cookies = [
            'spotify_access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
            'spotify_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
            'spotify_token_expiry=; Path=/; SameSite=Lax; Max-Age=0'
          ];
          
          res.setHeader('Set-Cookie', cookies);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
          return;
        }

        next();
      });
    },
  };
}