import { useEffect, useState } from 'react';
import { ExternalLink, Music, Sparkles, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { Room } from '@/types/wejay';

interface SpotifyPlaylistSyncProps {
  playlistUrl?: string;
  hasTracksInQueue?: boolean;
  room?: Room;
}

export function SpotifyPlaylistSync({ playlistUrl, hasTracksInQueue, room }: SpotifyPlaylistSyncProps) {
  const [url, setUrl] = useState(playlistUrl);
  const [isCreating, setIsCreating] = useState(false);
  const { accessToken } = useAuth();

  useEffect(() => {
    // Only update if we don't already have a URL
    // This prevents overwriting manually set URL
    if (playlistUrl && !url) {
      setUrl(playlistUrl);
    }
  }, [playlistUrl, url]);

  const handleCreatePlaylist = async () => {
    console.log('[SpotifyPlaylistSync] handleCreatePlaylist called');
    console.log('[SpotifyPlaylistSync] room:', room?.id);
    console.log('[SpotifyPlaylistSync] accessToken:', accessToken ? 'present' : 'missing');

    if (!room || !accessToken) {
      toast.error('Unable to create playlist', {
        description: 'Please make sure you are logged in and in a room',
      });
      return;
    }

    setIsCreating(true);
    toast.info('Creating Spotify playlist...', {
      description: 'This may take a few seconds',
    });

    try {
      const response = await fetch(`/api/rooms/${room.id}/create-playlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to create playlist');
      }

      const data = await response.json();
      console.log('[SpotifyPlaylistSync] Playlist created:', data);

      // Update URL immediately (this will show the button)
      setUrl(data.playlistUrl);

      toast.success('Spotify playlist created!', {
        description: 'Open it in Spotify to play on Sonos!',
      });
    } catch (error) {
      console.error('[SpotifyPlaylistSync] Error creating playlist:', error);
      toast.error('Failed to create playlist', {
        description: 'Please try again',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!url) {
    return (
      <div className="neumorphic p-4 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="neumorphic w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm mb-1 uppercase">Sonos Ready</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {hasTracksInQueue 
                ? 'Create a Spotify playlist for this room:'
                : 'Create a Spotify playlist to play on Sonos:'}
            </p>
            <Button
              onClick={handleCreatePlaylist}
              disabled={isCreating}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Music className="w-3 h-3 mr-2" />
                  Create Playlist Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="neumorphic p-4 rounded-xl bg-gradient-to-br from-[#1DB954]/5 to-transparent border border-[#1DB954]/10">
      <div className="flex items-start gap-3">
        <div className="neumorphic w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#1DB954]">
          <Music className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm mb-1 uppercase flex items-center gap-2">
            <span>Spotify Playlist</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954]">AUTO-SYNCED</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Play on Sonos • Syncs automatically with queue
          </p>
          <Button
            onClick={() => window.open(url, '_blank')}
            size="sm"
            className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
          >
            <ExternalLink className="w-3 h-3 mr-2" />
            Open in Spotify
          </Button>
        </div>
      </div>
    </div>
  );
}
