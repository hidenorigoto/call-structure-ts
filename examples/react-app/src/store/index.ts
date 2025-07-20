import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { authSlice, AuthSlice } from './slices/authSlice';
import { userSlice, UserSlice } from './slices/userSlice';
import { productSlice, ProductSlice } from './slices/productSlice';
import { cartSlice, CartSlice } from './slices/cartSlice';
import { uiSlice, UISlice } from './slices/uiSlice';

export interface AppStore extends AuthSlice, UserSlice, ProductSlice, CartSlice, UISlice {
  initialize: () => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Combine all slices
        ...authSlice(set, get),
        ...userSlice(set, get),
        ...productSlice(set, get),
        ...cartSlice(set, get),
        ...uiSlice(set, get),
        
        // Global actions
        initialize: () => {
          const auth = get().auth;
          if (auth.isAuthenticated && auth.token) {
            // Restore authentication state
            get().validateToken();
          }
          
          // Load user preferences
          const savedTheme = localStorage.getItem('theme');
          if (savedTheme) {
            get().setTheme(savedTheme as 'light' | 'dark');
          }
        },
        
        reset: () => {
          set({
            // Reset all slices to initial state
            auth: authSlice(set, get).auth,
            user: userSlice(set, get).user,
            products: productSlice(set, get).products,
            cart: cartSlice(set, get).cart,
            ui: uiSlice(set, get).ui,
          });
        },
      }),
      {
        name: 'app-store',
        partialize: (state) => ({
          auth: state.auth,
          cart: state.cart,
          ui: { theme: state.ui.theme },
        }),
      }
    )
  )
);