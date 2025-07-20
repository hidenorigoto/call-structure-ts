import { apiClient } from './api';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', { email, password });
  }

  async register(data: RegisterData): Promise<void> {
    await apiClient.post('/auth/register', data);
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
      console.error('Logout error:', error);
    }
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/refresh', { refreshToken });
  }

  async getCurrentUser(): Promise<LoginResponse['user']> {
    return apiClient.get<LoginResponse['user']>('/auth/me');
  }

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, newPassword });
  }

  async verifyEmail(token: string): Promise<void> {
    await apiClient.post('/auth/verify-email', { token });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  }
}

export const authService = new AuthService();