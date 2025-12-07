import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const Callback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useSpotifyAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasProcessed.current) {
      console.log('Callback already processed, skipping...');
      return;
    }

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('Callback params:', { code: code?.substring(0, 10), errorParam, state });

    if (errorParam) {
      console.error('Spotify auth error:', errorParam);
      setError(`Spotify authentication error: ${errorParam}`);
      setIsProcessing(false);
      return;
    }

    if (!code) {
      setError('No authorization code received from Spotify');
      setIsProcessing(false);
      return;
    }

    if (!state) {
      setError('Missing state parameter');
      setIsProcessing(false);
      return;
    }

    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        await handleCallback(code, state);
        // Navigation will happen automatically after successful auth
      } catch (err) {
        console.error('Callback processing failed:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, handleCallback]);

  const handleRetry = () => {
    navigate('/');
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground uppercase">Completing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="neumorphic p-8 space-y-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-2">Authentication Failed</h2>
            <p className="text-muted-foreground text-sm">
              {error || 'An error occurred during Spotify authentication'}
            </p>
          </div>

          <div className="space-y-3">
            <Button onClick={handleRetry} className="w-full neumorphic">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <p className="text-xs text-muted-foreground">
              If the problem persists, please check your Spotify Developer Dashboard settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Callback;