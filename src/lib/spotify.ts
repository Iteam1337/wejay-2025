// Get user's access token from httpOnly cookie via backend
async function getUserAccessToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/token', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      return null;
    }
    
    const { access_token } = await response.json();
    return access_token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  duration_ms: number;
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[];
  };
}

export async function searchSpotify(query: string): Promise<SpotifyTrack[]> {
  if (!query.trim()) return [];

  const token = await getUserAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated with Spotify');
  }
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&market=SE&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (refreshResponse.ok) {
        // Retry search with new token
        return searchSpotify(query);
      }
      
      throw new Error('Spotify session expired - please login again');
    }
    throw new Error('Spotify search failed');
  }

  const data: SpotifySearchResult = await response.json();
  return data.tracks.items;
}

export interface SpotifyRecommendationsParams {
  seed_tracks?: string[];
  seed_artists?: string[];
  seed_genres?: string[];
  limit?: number;
  market?: string;
}

export async function getSpotifyRecommendations(
  params: SpotifyRecommendationsParams
): Promise<SpotifyTrack[]> {
  const token = await getUserAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated with Spotify');
  }

  // Build query parameters
  const queryParams = new URLSearchParams();
  
  if (params.seed_tracks && params.seed_tracks.length > 0) {
    queryParams.append('seed_tracks', params.seed_tracks.join(','));
  }
  
  if (params.seed_artists && params.seed_artists.length > 0) {
    queryParams.append('seed_artists', params.seed_artists.join(','));
  }
  
  if (params.seed_genres && params.seed_genres.length > 0) {
    queryParams.append('seed_genres', params.seed_genres.join(','));
  }
  
  queryParams.append('limit', String(params.limit || 10));
  queryParams.append('market', params.market || 'SE');

  const response = await fetch(
    `https://api.spotify.com/v1/recommendations?${queryParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (refreshResponse.ok) {
        // Retry with new token
        return getSpotifyRecommendations(params);
      }
      
      throw new Error('Spotify session expired - please login again');
    }
    throw new Error('Failed to get recommendations');
  }

  const data = await response.json();
  return data.tracks || [];
}

export interface SpotifySavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

export async function getUserSavedTracks(limit: number = 50): Promise<SpotifyTrack[]> {
  const token = await getUserAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated with Spotify');
  }

  const response = await fetch(
    `https://api.spotify.com/v1/me/tracks?limit=${limit}&market=SE`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, try to refresh
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (refreshResponse.ok) {
        // Retry with new token
        return getUserSavedTracks(limit);
      }
      
      throw new Error('Spotify session expired - please login again');
    }
    throw new Error('Failed to get saved tracks');
  }

  const data: { items: SpotifySavedTrack[] } = await response.json();
  return data.items.map(item => item.track);
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  images: { url: string }[];
}

export async function getCurrentUser(): Promise<SpotifyUser> {
  const token = await getUserAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated with Spotify');
  }

  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (refreshResponse.ok) {
        return getCurrentUser();
      }
      
      throw new Error('Spotify session expired - please login again');
    }
    throw new Error('Failed to get current user');
  }

  return response.json();
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  external_urls: {
    spotify: string;
  };
}

export async function createPlaylist(name: string, description: string): Promise<SpotifyPlaylist> {
  const token = await getUserAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated with Spotify');
  }

  // Get current user ID
  const user = await getCurrentUser();

  const response = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description,
      public: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (refreshResponse.ok) {
        return createPlaylist(name, description);
      }
      
      throw new Error('Spotify session expired - please login again');
    }
    throw new Error('Failed to create playlist');
  }

  return response.json();
}

export async function replacePlaylistTracks(playlistId: string, trackUris: string[]): Promise<void> {
  const token = await getUserAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated with Spotify');
  }

  // Spotify limits to 100 tracks per request
  const chunks = [];
  for (let i = 0; i < trackUris.length; i += 100) {
    chunks.push(trackUris.slice(i, i + 100));
  }

  // Replace with first chunk
  if (chunks.length > 0) {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: chunks[0],
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        
        if (refreshResponse.ok) {
          return replacePlaylistTracks(playlistId, trackUris);
        }
        
        throw new Error('Spotify session expired - please login again');
      }
      throw new Error('Failed to update playlist');
    }
  }

  // Add remaining chunks
  for (let i = 1; i < chunks.length; i++) {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: chunks[i],
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add tracks to playlist');
    }
  }
}
