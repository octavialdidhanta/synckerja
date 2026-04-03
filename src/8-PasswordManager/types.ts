export interface Password {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  category: string;
  notes?: string;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export type FilterType = "all" | "favorites" | "category";

export interface PasswordFormData {
  title: string;
  username: string;
  password: string;
  url?: string;
  category: string;
  notes?: string;
  isFavorite: boolean;
}
