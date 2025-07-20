import { StateCreator } from 'zustand';
import { Product } from './productSlice';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface CartSlice {
  cart: CartState;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const cartSlice: StateCreator<CartSlice> = (set, get) => ({
  cart: {
    items: [],
    total: 0,
    itemCount: 0,
  },
  
  addToCart: (product, quantity = 1) => {
    const currentItems = get().cart.items;
    const existingItem = currentItems.find(item => item.product.id === product.id);
    
    let newItems: CartItem[];
    
    if (existingItem) {
      newItems = currentItems.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      newItems = [...currentItems, { product, quantity }];
    }
    
    const total = newItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
    
    set({
      cart: {
        items: newItems,
        total,
        itemCount,
      },
    });
  },
  
  removeFromCart: (productId) => {
    const newItems = get().cart.items.filter(item => item.product.id !== productId);
    
    const total = newItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
    
    set({
      cart: {
        items: newItems,
        total,
        itemCount,
      },
    });
  },
  
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    
    const newItems = get().cart.items.map(item =>
      item.product.id === productId ? { ...item, quantity } : item
    );
    
    const total = newItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
    
    set({
      cart: {
        items: newItems,
        total,
        itemCount,
      },
    });
  },
  
  clearCart: () => {
    set({
      cart: {
        items: [],
        total: 0,
        itemCount: 0,
      },
    });
  },
  
  getCartTotal: () => {
    return get().cart.total;
  },
});