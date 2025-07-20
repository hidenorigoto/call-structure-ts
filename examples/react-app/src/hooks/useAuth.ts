import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';

export function useAuth() {
  const navigate = useNavigate();
  const { auth, login, logout, refreshAuth } = useAppStore();

  useEffect(() => {
    // Set up token refresh interval
    if (auth.isAuthenticated && auth.token) {
      const interval = setInterval(() => {
        refreshAuth();
      }, 10 * 60 * 1000); // Refresh every 10 minutes

      return () => clearInterval(interval);
    }
  }, [auth.isAuthenticated, auth.token, refreshAuth]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      try {
        await login(email, password);
        navigate('/dashboard');
      } catch (error) {
        // Error is handled in the store
        console.error('Login failed:', error);
      }
    },
    [login, navigate]
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  return {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    loading: auth.loading,
    error: auth.error,
    login: handleLogin,
    logout: handleLogout,
  };
}