import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Music, Users, Sparkles } from 'lucide-react';
import { toast } from '@/lib/toast';

const Login = () => {
  const { user, isLoading, login, isAuthenticated, isPremium } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Check for error in URL params
    const error = searchParams.get('error');
    if (error) {
      toast.error('Authentication Failed', {
        description: 'Please try logging in again.',
      });
      // Clean up URL
      navigate('/', { replace: true });
    }

    // If already authenticated, redirect to room selection
    if (isAuthenticated && user) {
      if (!isPremium) {
        toast.error('Spotify Premium Required', {
          description: 'Wejay requires Spotify Premium for full functionality.',
          duration: 5000,
        });
      } else {
        navigate('/rooms', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, isPremium, searchParams]);

  const handleLogin = () => {
    login();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground uppercase">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="neumorphic p-4 rounded-full">
              <Music className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-tight">Wejay</h1>
            <p className="text-muted-foreground mt-2">
              Collaborative music sessions with friends
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="neumorphic p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold uppercase">Welcome Back</h2>
              <p className="text-sm text-muted-foreground">
                Connect with Spotify to start sharing music
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-left">
                <Users className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">Join rooms with friends</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <Music className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">Share and queue tracks</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">Real-time synchronization</span>
              </div>
            </div>

            {/* Spotify Login Button */}
            <Button 
              onClick={handleLogin}
              className="w-full neumorphic bg-[#1DB954] hover:bg-[#1ed760] text-white font-semibold py-6"
              size="lg"
            >
              <svg 
                className="w-5 h-5 mr-2" 
                viewBox="0 0 24 24" 
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Continue with Spotify
            </Button>

            <p className="text-xs text-muted-foreground">
              Spotify Premium is required for full functionality
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>By continuing, you agree to connect your Spotify account</p>
        </div>
      </div>
    </div>
  );
};

export default Login;