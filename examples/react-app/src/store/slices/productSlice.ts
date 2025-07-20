import { StateCreator } from 'zustand';
import { productService } from '../../services/productService';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  rating: number;
  reviews: number;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'price' | 'rating' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductState {
  items: Product[];
  selectedProduct: Product | null;
  filters: ProductFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  error: string | null;
}

export interface ProductSlice {
  products: ProductState;
  fetchProducts: () => Promise<void>;
  fetchProductById: (id: string) => Promise<void>;
  setProductFilters: (filters: ProductFilters) => void;
  setPage: (page: number) => void;
  clearSelectedProduct: () => void;
}

export const productSlice: StateCreator<ProductSlice> = (set, get) => ({
  products: {
    items: [],
    selectedProduct: null,
    filters: {},
    pagination: {
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 0,
    },
    loading: false,
    error: null,
  },
  
  fetchProducts: async () => {
    const { filters, pagination } = get().products;
    set({ products: { ...get().products, loading: true, error: null } });
    
    try {
      const response = await productService.getProducts({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      });
      
      set({
        products: {
          ...get().products,
          items: response.products,
          pagination: {
            ...pagination,
            total: response.total,
            totalPages: response.totalPages,
          },
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        products: {
          ...get().products,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch products',
        },
      });
    }
  },
  
  fetchProductById: async (id) => {
    set({ products: { ...get().products, loading: true, error: null } });
    
    try {
      const product = await productService.getProductById(id);
      set({
        products: {
          ...get().products,
          selectedProduct: product,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set({
        products: {
          ...get().products,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch product',
        },
      });
    }
  },
  
  setProductFilters: (filters) => {
    set({
      products: {
        ...get().products,
        filters,
        pagination: {
          ...get().products.pagination,
          page: 1, // Reset to first page when filters change
        },
      },
    });
    
    // Fetch products with new filters
    get().fetchProducts();
  },
  
  setPage: (page) => {
    set({
      products: {
        ...get().products,
        pagination: {
          ...get().products.pagination,
          page,
        },
      },
    });
    
    // Fetch products for new page
    get().fetchProducts();
  },
  
  clearSelectedProduct: () => {
    set({
      products: {
        ...get().products,
        selectedProduct: null,
      },
    });
  },
});