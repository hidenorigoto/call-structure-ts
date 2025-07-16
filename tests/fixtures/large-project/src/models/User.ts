export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date;
  role: 'admin' | 'user' | 'guest';
}

export interface UserProfile extends Omit<User, 'password'> {
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}
