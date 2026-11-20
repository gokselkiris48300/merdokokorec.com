export type CategoryType = 'food' | 'beverage';

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number | null;
  isAvailable: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string | null;
  type: CategoryType;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
  items: MenuItem[];
}

export interface StandSettings {
  businessName: string;
  tagline: string;
  wifiName: string;
  wifiPassword: string;
  defaultTableCount: number;
  updatedAt: string;
}

export interface MenuResponse {
  categories: MenuCategory[];
  settings: StandSettings;
  updatedAt: string;
}

export interface AdminUser {
  username: string;
  displayName: string;
  isDefaultPassword: boolean;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: AdminUser | null;
  showInitialHint: boolean;
}

export interface AuditLogEntry {
  id: number;
  adminUsername: string;
  itemId: string;
  categoryName: string;
  itemName: string;
  oldPrice: number | null;
  newPrice: number | null;
  action: string;
  createdAt: string;
}

export type AppView = 'menu' | 'stand' | 'admin';
