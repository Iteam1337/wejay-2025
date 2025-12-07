import { useState, useEffect, useCallback } from 'react';
import { SpotifyUser } from '@/types/wejay';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;
const SCOPE = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state streaming playlist-modify-private playlist-modify-public user-library-read';

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
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
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
      // Get token from httpOnly cookie via backend
      const tokenResponse = await fetch('/api/auth/token', {
        credentials: 'include',
      });

      if (!tokenResponse.ok) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const { access_token } = await tokenResponse.json();

      // Validate token by fetching user profile
      const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (userResponse.ok) {
        const user = await userResponse.json();
        setAuthState({
          user: {
            id: user.id,
            display_name: user.display_name,
            email: user.email,
            images: user.images || [],
            country: user.country,
            product: user.product,
          },
          accessToken: access_token,
          isLoading: false,
          error: null,
        });
        
        // Store user in localStorage for quick access (not sensitive)
        localStorage.setItem('spotify_user', JSON.stringify({
          id: user.id,
          display_name: user.display_name,
          email: user.email,
          images: user.images || [],
          country: user.country,
          product: user.product,
        }));
        return;
      } else if (userResponse.status === 401) {
        // Token expired, try to refresh
        console.log('Token expired, attempting refresh...');
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshResponse.ok) {
          // Retry with new token
          checkAuthStatus();
          return;
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

      // Generate state parameter for security
      const state = Math.random().toString(36).substring(2, 15);

      // Store verifier on backend server (not in localStorage!)
      console.log('Storing verifier on backend...');
      const storeResponse = await fetch('/api/auth/store-verifier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verifier,
          state,
        }),
      });

      if (!storeResponse.ok) {
        throw new Error('Failed to store verifier on backend');
      }

      console.log('Verifier stored on backend successfully');

      // Save only state in localStorage (doesn't matter if it gets cleared)
      localStorage.setItem('spotify_auth_state', state);

      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', CLIENT_ID);
      authUrl.searchParams.append('scope', SCOPE);
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('code_challenge', challenge);
      authUrl.searchParams.append('state', state);

      console.log('Initiating Spotify auth with redirect URI:', REDIRECT_URI);
      console.log('State:', state);
      
      // Redirect to Spotify auth
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Login failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to initiate login',
      }));
    }
  }, [REDIRECT_URI]);

  const handleCallback = useCallback(async (code: string, state: string) => {
    try {
      console.log('Handling Spotify callback with code:', code.substring(0, 10) + '...');
      console.log('State from URL:', state);
      
      // Exchange code for access token via backend proxy
      // Backend will retrieve code_verifier using the state parameter
      console.log('Exchanging code for token via backend with redirect URI:', REDIRECT_URI);
      
      const response = await fetch('/api/auth/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: REDIRECT_URI,
          state: state,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Token exchange failed:', response.status, errorData);
        throw new Error(`Failed to exchange code for token: ${response.status} ${errorData}`);
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

      // Store user data (tokens are in httpOnly cookies)
      localStorage.setItem('spotify_user', JSON.stringify(user));

      setAuthState({
        user,
        accessToken: tokenData.access_token,
        isLoading: false,
        error: null,
      });

      // Clean up
      localStorage.removeItem('spotify_auth_state');

      // Redirect to main app
      window.location.href = '/rooms';
    } catch (error) {
      console.error('Callback handling failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to complete authentication',
      }));
    }
  }, [REDIRECT_URI]);

  const logout = useCallback(async () => {
    // Clear cookies on server
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    // Clear localStorage
    localStorage.removeItem('spotify_user');
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_auth_state');
    
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