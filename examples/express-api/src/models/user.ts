export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  role?: 'user' | 'admin';
  isActive?: boolean;
  isVerified?: boolean;
}