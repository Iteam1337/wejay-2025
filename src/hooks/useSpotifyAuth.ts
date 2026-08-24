import { useState, useEffect, useCallback } from 'react';
import { SpotifyUser } from '@/types/wejay';
import {
  generateCodeVerifier,
  generateSecureState,
  generateCodeChallenge,
  buildAuthUrl,
  storeVerifier,
  exchangeToken,
  fetchSpotifyUser,
  saveUserToStorage,
  clearAuthStorage,
} from '@/lib/spotify-auth';

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

  const checkAuthStatus = useCallback(async () => {
    try {
      const tokenResponse = await fetch('/api/auth/token', {
        credentials: 'include',
      });

      if (!tokenResponse.ok) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const { access_token } = await tokenResponse.json();

      try {
        const user = await fetchSpotifyUser(access_token);
        const spotifyUser: SpotifyUser = {
          id: user.id,
          display_name: user.display_name,
          email: user.email,
          images: user.images || [],
          country: user.country,
          product: user.product,
        };

        setAuthState({
          user: spotifyUser,
          accessToken: access_token,
          isLoading: false,
          error: null,
        });

        saveUserToStorage(spotifyUser);
        return;
      } catch (error) {
        if (error instanceof Error && error.message.includes('401')) {
          console.log('Token expired, attempting refresh...');
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            checkAuthStatus();
            return;
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check authentication status',
      }));
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async () => {
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const state = generateSecureState();

      await storeVerifier(verifier, state);
      localStorage.setItem('spotify_auth_state', state);

      const authUrl = buildAuthUrl(challenge, state);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to initiate login',
      }));
    }
  }, []);

  const handleCallback = useCallback(async (code: string, state: string) => {
    try {
      const tokenData = await exchangeToken(code, state);
      const userData = await fetchSpotifyUser(tokenData.access_token);

      const user: SpotifyUser = {
        id: userData.id,
        display_name: userData.display_name,
        email: userData.email,
        images: userData.images || [],
        country: userData.country,
        product: userData.product,
      };

      saveUserToStorage(user);

      setAuthState({
        user,
        accessToken: tokenData.access_token,
        isLoading: false,
        error: null,
      });

      clearAuthStorage();
      window.location.href = '/rooms';
    } catch (error) {
      console.error('Callback handling failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to complete authentication',
      }));
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    clearAuthStorage();

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
