const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPE = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state streaming playlist-modify-private playlist-modify-public user-library-read';

export function getRedirectUri(): string {
  return REDIRECT_URI;
}

export function buildAuthUrl(challenge: string, state: string): string {
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('scope', SCOPE);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('code_challenge', challenge);
  authUrl.searchParams.append('state', state);
  return authUrl.toString();
}

export function generateSecureRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

export function generateCodeVerifier(): string {
  return generateSecureRandomString(128);
}

export function generateSecureState(): string {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const randomPart = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${timestamp}_${randomPart}`;
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function storeVerifier(verifier: string, state: string): Promise<void> {
  const response = await fetch('/api/auth/store-verifier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verifier, state }),
  });

  if (!response.ok) {
    throw new Error('Failed to store verifier on backend');
  }
}

export async function exchangeToken(code: string, state: string): Promise<{ access_token: string; expires_in: number; token_type: string }> {
  const response = await fetch('/api/auth/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      redirect_uri: REDIRECT_URI,
      state,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to exchange code for token: ${response.status} ${errorData}`);
  }

  return response.json();
}

export async function fetchSpotifyUser(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return response.json();
}

export function saveUserToStorage(user: unknown): void {
  localStorage.setItem('spotify_user', JSON.stringify(user));
}

export function clearAuthStorage(): void {
  localStorage.removeItem('spotify_user');
  localStorage.removeItem('spotify_code_verifier');
  localStorage.removeItem('spotify_auth_state');
}
