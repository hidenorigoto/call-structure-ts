import { StateCreator } from 'zustand';
import { userService } from '../../services/userService';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  preferences: {
    notifications: boolean;
    newsletter: boolean;
    theme: 'light' | 'dark' | 'system';
  };
}

export interface UserState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export interface UserSlice {
  user: UserState;
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  updatePreferences: (preferences: Partial<UserProfile['preferences']>) => Promise<void>;
}

export const userSlice: StateCreator<UserSlice> = (set, get) => ({
  user: {
    profile: null,
    loading: false,
    error: null,
  },
  
  fetchUserProfile: async () => {
    set({ user: { ...get().user, loading: true, error: null } });
    
    try {
      const profile = await userService.getProfile();
      set({
        user: {
          profile,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        user: {
          ...get().user,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch profile',
        },
      });
    }
  },
  
  updateUserProfile: async (updates) => {
    set({ user: { ...get().user, loading: true, error: null } });
    
    try {
      const updatedProfile = await userService.updateProfile(updates);
      set({
        user: {
          profile: updatedProfile,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        user: {
          ...get().user,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to update profile',
        },
      });
      throw error;
    }
  },
  
  uploadAvatar: async (file) => {
    set({ user: { ...get().user, loading: true, error: null } });
    
    try {
      const avatarUrl = await userService.uploadAvatar(file);
      const currentProfile = get().user.profile;
      
      if (currentProfile) {
        set({
          user: {
            profile: { ...currentProfile, avatar: avatarUrl },
            loading: false,
            error: null,
          },
        });
      }
    } catch (error) {
      set({
        user: {
          ...get().user,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to upload avatar',
        },
      });
      throw error;
    }
  },
  
  updatePreferences: async (preferences) => {
    const currentProfile = get().user.profile;
    if (!currentProfile) return;
    
    const updatedPreferences = {
      ...currentProfile.preferences,
      ...preferences,
    };
    
    await get().updateUserProfile({ preferences: updatedPreferences });
  },
});