import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAppStore } from '../store';
import { tokenService } from '../services/tokenService';

interface AuthContextValue {
  isAuthenticated: boolean;
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth, login, logout, validateToken, clearAuthError } = useAppStore();

  useEffect(() => {
    // Check for existing token on mount
    const token = tokenService.getAccessToken();
    if (token && !auth.isAuthenticated) {
      validateToken();
    }
  }, []);

  useEffect(() => {
    // Clear auth error after 5 seconds
    if (auth.error) {
      const timer = setTimeout(() => {
        clearAuthError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [auth.error, clearAuthError]);

  const value: AuthContextValue = {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    login,
    logout,
    loading: auth.loading,
    error: auth.error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}