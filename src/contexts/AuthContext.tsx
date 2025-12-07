import React, { createContext, useContext, ReactNode } from 'react';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { SpotifyUser } from '@/types/wejay';

interface AuthContextType {
  user: SpotifyUser | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  handleCallback: (code: string, state: string) => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  isAuthenticated: boolean;
  isPremium: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = useSpotifyAuth();

  const value: AuthContextType = {
    ...auth,
    isAuthenticated: !!auth.user && !!auth.accessToken,
    isPremium: auth.user?.product === 'premium',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};