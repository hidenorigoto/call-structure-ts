import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/productService';
import { Product, ProductFilters } from '../store/slices/productSlice';

export function useProducts(filters?: ProductFilters, page: number = 1, limit: number = 12) {
  return useQuery({
    queryKey: ['products', filters, page, limit],
    queryFn: () => productService.getProducts({ ...filters, page, limit }),
    keepPreviousData: true,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getProductById(id),
    enabled: !!id,
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productService.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useProductSearch(searchTerm: string) {
  return useQuery({
    queryKey: ['product-search', searchTerm],
    queryFn: () => productService.searchProducts(searchTerm),
    enabled: searchTerm.length > 2,
    debounce: 300,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Omit<Product, 'id' | 'rating' | 'reviews'>) => 
      productService.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => 
      productService.updateProduct(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Custom hook for product filtering and pagination
export function useProductList() {
  const { products, setProductFilters, setPage } = useAppStore();
  const { data, isLoading, error } = useProducts(
    products.filters,
    products.pagination.page,
    products.pagination.limit
  );

  const handleFilterChange = (filters: ProductFilters) => {
    setProductFilters(filters);
  };

  const handlePageChange = (page: number) => {
    setPage(page);
  };

  return {
    products: data?.products || [],
    pagination: data ? {
      page: data.page,
      totalPages: data.totalPages,
      total: data.total,
    } : products.pagination,
    filters: products.filters,
    isLoading,
    error,
    onFilterChange: handleFilterChange,
    onPageChange: handlePageChange,
  };
}