import { useState, useEffect, useCallback } from 'react';
import { SpotifyUser } from '@/types/wejay';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPE = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state streaming';

interface AuthState {
  user: SpotifyUser | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useSpotifyAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    error: null,
  });

  // Generate random string for PKCE
  const generateRandomString = (length: number): string => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  };

  // Generate code verifier for PKCE
  const generateCodeVerifier = (): string => {
    return generateRandomString(128);
  };

  // Generate code challenge from code verifier
  const generateCodeChallenge = async (verifier: string): Promise<string> => {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  // Check for existing auth on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('spotify_access_token');
      const storedUser = localStorage.getItem('spotify_user');

      if (storedToken && storedUser) {
        // Validate token by fetching user profile
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          const user = await response.json();
          setAuthState({
            user: {
              id: user.id,
              display_name: user.display_name,
              email: user.email,
              images: user.images || [],
              country: user.country,
              product: user.product,
            },
            accessToken: storedToken,
            isLoading: false,
            error: null,
          });
          return;
        } else {
          // Token is invalid, clear storage
          localStorage.removeItem('spotify_access_token');
          localStorage.removeItem('spotify_user');
        }
      }

      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check authentication status',
      }));
    }
  }, []);

  const login = useCallback(async () => {
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      // Store verifier for callback
      sessionStorage.setItem('spotify_code_verifier', verifier);

      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', CLIENT_ID);
      authUrl.searchParams.append('scope', SCOPE);
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('code_challenge', challenge);

      // Redirect to Spotify auth
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Login failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to initiate login',
      }));
    }
  }, []);

  const handleCallback = useCallback(async (code: string) => {
    try {
      const verifier = sessionStorage.getItem('spotify_code_verifier');
      if (!verifier) {
        throw new Error('Code verifier not found');
      }

      // Exchange code for access token
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: verifier,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await response.json();

      // Fetch user profile
      const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData = await userResponse.json();

      const user: SpotifyUser = {
        id: userData.id,
        display_name: userData.display_name,
        email: userData.email,
        images: userData.images || [],
        country: userData.country,
        product: userData.product,
      };

      // Store auth data
      localStorage.setItem('spotify_access_token', tokenData.access_token);
      localStorage.setItem('spotify_user', JSON.stringify(user));

      setAuthState({
        user,
        accessToken: tokenData.access_token,
        isLoading: false,
        error: null,
      });

      // Clean up
      sessionStorage.removeItem('spotify_code_verifier');

      // Redirect to main app
      window.location.href = '/';
    } catch (error) {
      console.error('Callback handling failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to complete authentication',
      }));
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_user');
    sessionStorage.removeItem('spotify_code_verifier');
    
    setAuthState({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...authState,
    login,
    logout,
    handleCallback,
    checkAuthStatus,
  };
}