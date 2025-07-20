import { StateCreator } from 'zustand';

export interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  modalStack: string[];
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  loading: {
    global: boolean;
    [key: string]: boolean;
  };
}

export interface UISlice {
  ui: UIState;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;
  showNotification: (type: UIState['notifications'][0]['type'], message: string) => void;
  removeNotification: (id: string) => void;
  setLoading: (key: string, loading: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
}

export const uiSlice: StateCreator<UISlice> = (set, get) => ({
  ui: {
    theme: 'light',
    sidebarOpen: true,
    modalStack: [],
    notifications: [],
    loading: {
      global: false,
    },
  },
  
  setTheme: (theme) => {
    set({
      ui: {
        ...get().ui,
        theme,
      },
    });
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  },
  
  toggleSidebar: () => {
    set({
      ui: {
        ...get().ui,
        sidebarOpen: !get().ui.sidebarOpen,
      },
    });
  },
  
  openModal: (modalId) => {
    const currentStack = get().ui.modalStack;
    if (!currentStack.includes(modalId)) {
      set({
        ui: {
          ...get().ui,
          modalStack: [...currentStack, modalId],
        },
      });
    }
  },
  
  closeModal: (modalId) => {
    set({
      ui: {
        ...get().ui,
        modalStack: get().ui.modalStack.filter(id => id !== modalId),
      },
    });
  },
  
  closeAllModals: () => {
    set({
      ui: {
        ...get().ui,
        modalStack: [],
      },
    });
  },
  
  showNotification: (type, message) => {
    const notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
    };
    
    set({
      ui: {
        ...get().ui,
        notifications: [...get().ui.notifications, notification],
      },
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeNotification(notification.id);
    }, 5000);
  },
  
  removeNotification: (id) => {
    set({
      ui: {
        ...get().ui,
        notifications: get().ui.notifications.filter(n => n.id !== id),
      },
    });
  },
  
  setLoading: (key, loading) => {
    set({
      ui: {
        ...get().ui,
        loading: {
          ...get().ui.loading,
          [key]: loading,
        },
      },
    });
  },
  
  setGlobalLoading: (loading) => {
    set({
      ui: {
        ...get().ui,
        loading: {
          ...get().ui.loading,
          global: loading,
        },
      },
    });
  },
});