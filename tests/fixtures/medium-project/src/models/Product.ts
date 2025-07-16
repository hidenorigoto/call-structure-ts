export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  featured: boolean;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
  archived?: boolean;
  imageUrl?: string;
  availability?: string;
}
