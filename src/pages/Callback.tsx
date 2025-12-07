import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';

const Callback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useSpotifyAuth();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Spotify auth error:', error);
      navigate('/?error=auth_failed');
      return;
    }

    if (code) {
      handleCallback(code);
    } else {
      navigate('/?error=no_code');
    }
  }, [searchParams, handleCallback, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground uppercase">Completing authentication...</p>
      </div>
    </div>
  );
};

export default Callback;