import { apiClient } from './api';
import { Product, ProductFilters } from '../store/slices/productSlice';

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

interface ProductQueryParams extends ProductFilters {
  page?: number;
  limit?: number;
}

class ProductService {
  async getProducts(params?: ProductQueryParams): Promise<ProductsResponse> {
    return apiClient.get<ProductsResponse>('/products', { params });
  }

  async getProductById(id: string): Promise<Product> {
    return apiClient.get<Product>(`/products/${id}`);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const response = await apiClient.get<ProductsResponse>('/products', {
      params: { search: query },
    });
    return response.products;
  }

  async getCategories(): Promise<string[]> {
    return apiClient.get<string[]>('/products/categories');
  }

  async createProduct(data: Omit<Product, 'id' | 'rating' | 'reviews'>): Promise<Product> {
    return apiClient.post<Product>('/products', data);
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return apiClient.put<Product>(`/products/${id}`, data);
  }

  async deleteProduct(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  }

  async getProductReviews(productId: string): Promise<any[]> {
    return apiClient.get<any[]>(`/products/${productId}/reviews`);
  }

  async addProductReview(productId: string, review: { rating: number; comment: string }): Promise<void> {
    await apiClient.post(`/products/${productId}/reviews`, review);
  }

  async getRelatedProducts(productId: string): Promise<Product[]> {
    return apiClient.get<Product[]>(`/products/${productId}/related`);
  }

  async checkStock(productId: string): Promise<{ available: boolean; quantity: number }> {
    return apiClient.get<{ available: boolean; quantity: number }>(`/products/${productId}/stock`);
  }
}

export const productService = new ProductService();