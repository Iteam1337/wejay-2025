import Router from '@koa/router';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const VERIFIER_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const USED_VERIFIER_CLEANUP_MS = 60 * 1000; // 1 minute
const REFRESH_TOKEN_EXPIRY_DAYS = 90;
const verifierStore = new Map();
function cleanupExpiredVerifiers() {
    const now = Date.now();
    for (const [key, value] of verifierStore.entries()) {
        if (now - value.timestamp > VERIFIER_EXPIRY_MS) {
            verifierStore.delete(key);
        }
    }
}
function scheduleVerifierCleanup(state) {
    setTimeout(() => {
        verifierStore.delete(state);
        console.log(`[Spotify Auth] Deleted used verifier for state: ${state}`);
    }, USED_VERIFIER_CLEANUP_MS);
}
function buildAuthHeader() {
    const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}
function setAuthCookies(ctx, data, includeRefresh = true) {
    const accessTokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    const cookies = [
        `spotify_access_token=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Expires=${accessTokenExpiry.toUTCString()}`,
        `spotify_token_expiry=${accessTokenExpiry.getTime()}; Path=/; SameSite=Lax; Expires=${accessTokenExpiry.toUTCString()}`,
    ];
    if (includeRefresh && data.refresh_token) {
        const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        cookies.push(`spotify_refresh_token=${data.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Expires=${refreshTokenExpiry.toUTCString()}`);
    }
    ctx.set('Set-Cookie', cookies);
}
function clearAuthCookies(ctx) {
    const cookies = [
        'spotify_access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        'spotify_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        'spotify_token_expiry=; Path=/; SameSite=Lax; Max-Age=0',
    ];
    ctx.set('Set-Cookie', cookies);
}
async function requestSpotifyToken(params) {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: buildAuthHeader(),
        },
        body: params,
    });
    const data = (await response.json());
    return { ok: response.ok, status: response.status, data };
}
function exchangeCodeForToken(code, redirectUri, codeVerifier) {
    return requestSpotifyToken(new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
    }));
}
function refreshAccessToken(refreshToken) {
    return requestSpotifyToken(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    }));
}
async function storeVerifier(ctx) {
    const { verifier, state } = ctx.request.body;
    if (!verifier || !state) {
        ctx.status = 400;
        ctx.body = { error: 'Missing verifier or state' };
        return;
    }
    verifierStore.set(state, { verifier, timestamp: Date.now(), used: false });
    console.log(`[Spotify Auth] Stored verifier for state: ${state}`);
    cleanupExpiredVerifiers();
    ctx.body = { success: true };
}
function validateExchangeRequest(body) {
    const missing = [
        !body.code && 'code',
        !body.redirect_uri && 'redirect_uri',
        !body.state && 'state',
    ].filter(Boolean);
    if (missing.length > 0) {
        return { valid: false, error: { status: 400, body: { error: 'Missing required parameters' } } };
    }
    return { valid: true };
}
function validateVerifier(stored, state) {
    if (!stored) {
        console.error(`[Spotify Auth] Verifier not found for state: ${state}`);
        return { valid: false, error: { status: 400, body: { error: 'Verifier not found - please try logging in again' } } };
    }
    if (stored.used) {
        console.log(`[Spotify Auth] Verifier already used for state: ${state}`);
        return { valid: false, error: { status: 200, body: { error: 'Already processed' } } };
    }
    if (Date.now() - stored.timestamp > VERIFIER_EXPIRY_MS) {
        verifierStore.delete(state);
        return { valid: false, error: { status: 410, body: { error: 'Authentication expired' } } };
    }
    return { valid: true };
}
function validateCredentials() {
    const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.error('[Spotify Auth] Missing credentials');
        return { valid: false, error: { status: 500, body: { error: 'Missing Spotify credentials' } } };
    }
    return { valid: true };
}
async function exchangeToken(ctx) {
    const body = ctx.request.body;
    const bodyValidation = validateExchangeRequest(body);
    if (!bodyValidation.valid) {
        ctx.status = bodyValidation.error.status;
        ctx.body = bodyValidation.error.body;
        return;
    }
    console.log(`[Spotify Auth] Exchange token for state: ${body.state}`);
    const stored = verifierStore.get(body.state);
    const verifierValidation = validateVerifier(stored, body.state);
    if (!verifierValidation.valid) {
        ctx.status = verifierValidation.error.status;
        ctx.body = verifierValidation.error.body;
        return;
    }
    const credentialsValidation = validateCredentials();
    if (!credentialsValidation.valid) {
        ctx.status = credentialsValidation.error.status;
        ctx.body = credentialsValidation.error.body;
        return;
    }
    stored.used = true;
    verifierStore.set(body.state, stored);
    scheduleVerifierCleanup(body.state);
    console.log('[Spotify Auth] Exchanging with Spotify...');
    const result = await exchangeCodeForToken(body.code, body.redirect_uri, stored.verifier);
    if (!result.ok) {
        console.error('[Spotify Auth] Spotify rejected:', result.data);
        ctx.status = result.status;
        ctx.body = { error: result.data };
        return;
    }
    console.log('[Spotify Auth] Token exchange successful!');
    setAuthCookies(ctx, result.data);
    ctx.body = {
        access_token: result.data.access_token,
        expires_in: result.data.expires_in,
        token_type: result.data.token_type,
    };
}
async function getToken(ctx) {
    const accessToken = ctx.cookies.get('spotify_access_token');
    if (!accessToken) {
        ctx.status = 401;
        ctx.body = { error: 'Not authenticated' };
        return;
    }
    ctx.body = { access_token: accessToken };
}
async function refreshToken(ctx) {
    const refreshTokenValue = ctx.cookies.get('spotify_refresh_token');
    if (!refreshTokenValue) {
        ctx.status = 401;
        ctx.body = { error: 'No refresh token' };
        return;
    }
    const result = await refreshAccessToken(refreshTokenValue);
    if (!result.ok) {
        console.error('[Spotify Auth] Refresh failed:', result.data);
        ctx.status = result.status;
        ctx.body = { error: 'Failed to refresh token' };
        return;
    }
    setAuthCookies(ctx, result.data, !!result.data.refresh_token);
    ctx.body = {
        access_token: result.data.access_token,
        expires_in: result.data.expires_in,
    };
}
async function logout(ctx) {
    clearAuthCookies(ctx);
    ctx.body = { success: true };
}
export function authMiddleware() {
    const router = new Router({ prefix: '/api/auth' });
    router.post('/store-verifier', storeVerifier);
    router.post('/exchange-token', exchangeToken);
    router.get('/token', getToken);
    router.post('/refresh', refreshToken);
    router.post('/logout', logout);
    return router.routes();
}
