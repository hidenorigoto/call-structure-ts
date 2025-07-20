import { apiClient } from './api';
import { UserProfile } from '../store/slices/userSlice';

class UserService {
  async getProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/users/me');
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    return apiClient.put<UserProfile>('/users/me', updates);
  }

  async uploadAvatar(file: File): Promise<string> {
    const response = await apiClient.upload<{ url: string }>('/users/me/avatar', file);
    return response.url;
  }

  async deleteAccount(): Promise<void> {
    await apiClient.delete('/users/me');
  }

  async getNotificationSettings(): Promise<any> {
    return apiClient.get('/users/me/notifications');
  }

  async updateNotificationSettings(settings: any): Promise<void> {
    await apiClient.put('/users/me/notifications', settings);
  }

  async getActivityHistory(): Promise<any[]> {
    return apiClient.get<any[]>('/users/me/activity');
  }

  async exportUserData(): Promise<Blob> {
    const response = await apiClient.get<Blob>('/users/me/export', {
      responseType: 'blob',
    });
    return response;
  }
}

export const userService = new UserService();