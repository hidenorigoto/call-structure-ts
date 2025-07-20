import { StateCreator } from 'zustand';
import { authService } from '../../services/authService';
import { tokenService } from '../../services/tokenService';

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
  loading: boolean;
  error: string | null;
}

export interface AuthSlice {
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  refreshAuth: () => Promise<void>;
  validateToken: () => Promise<void>;
  clearAuthError: () => void;
}

const initialAuthState: AuthState = {
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  user: null,
  loading: false,
  error: null,
};

export const authSlice: StateCreator<AuthSlice> = (set, get) => ({
  auth: initialAuthState,
  
  login: async (email, password) => {
    set({ auth: { ...get().auth, loading: true, error: null } });
    
    try {
      const response = await authService.login(email, password);
      
      tokenService.setTokens(response.accessToken, response.refreshToken);
      
      set({
        auth: {
          isAuthenticated: true,
          token: response.accessToken,
          refreshToken: response.refreshToken,
          user: response.user,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        auth: {
          ...get().auth,
          loading: false,
          error: error instanceof Error ? error.message : 'Login failed',
        },
      });
      throw error;
    }
  },
  
  logout: () => {
    tokenService.clearTokens();
    set({ auth: initialAuthState });
    
    // Call logout API
    authService.logout().catch(console.error);
  },
  
  register: async (data) => {
    set({ auth: { ...get().auth, loading: true, error: null } });
    
    try {
      await authService.register(data);
      set({
        auth: {
          ...get().auth,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        auth: {
          ...get().auth,
          loading: false,
          error: error instanceof Error ? error.message : 'Registration failed',
        },
      });
      throw error;
    }
  },
  
  refreshAuth: async () => {
    const refreshToken = get().auth.refreshToken;
    if (!refreshToken) return;
    
    try {
      const response = await authService.refreshToken(refreshToken);
      
      tokenService.setTokens(response.accessToken, response.refreshToken);
      
      set({
        auth: {
          ...get().auth,
          token: response.accessToken,
          refreshToken: response.refreshToken,
        },
      });
    } catch (error) {
      get().logout();
    }
  },
  
  validateToken: async () => {
    const token = get().auth.token;
    if (!token) return;
    
    try {
      const user = await authService.getCurrentUser();
      set({
        auth: {
          ...get().auth,
          user,
          isAuthenticated: true,
        },
      });
    } catch (error) {
      get().logout();
    }
  },
  
  clearAuthError: () => {
    set({
      auth: {
        ...get().auth,
        error: null,
      },
    });
  },
});