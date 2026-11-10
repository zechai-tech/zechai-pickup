export type UserRole = 'admin' | 'manager' | 'staff' | 'ordering_staff';

export interface Outlet {
  id: string;
  name: string;
  address: string | null;
  opening_time: string; // e.g. '15:00:00'
  closing_time: string; // e.g. '00:00:00'
  is_active: boolean;
  created_at: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  outlet_id: string | null;
  is_active: boolean;
  created_at: string;
  outlet?: Outlet | null;
  outlet_name?: string | null;
}

export interface MenuItem {
  id: string;
  outlet_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  is_bestseller: boolean;
  is_veg: boolean;
  sort_order: number;
  created_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'cancelled'
  | 'pending_payment'
  | 'confirmed'
  | 'completed'
  | 'payment_failed';

export interface OrderItem {
  id?: string;
  itemId?: string;
  name: string;
  price?: number;
  unitPrice?: number;
  qty?: number;
  quantity?: number;
  size?: string;
  sugar?: string;
  addons?: Array<{ id: string; name: string; priceDelta: number }>;
}

export interface Order {
  id: string;
  outlet_id: string;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  pickup_code: string;
  payment_id: string | null;
  kitchen_note?: string | null;
  created_at: string;
  updated_at: string;
  outlet?: Outlet | null;
}

export type Database = {
  public: {
    Tables: {
      outlets: {
        Row: Outlet;
        Insert: Omit<Outlet, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Outlet, 'id' | 'created_at'>>;
      };
      users: {
        Row: AppUser;
        Insert: Omit<AppUser, 'id' | 'created_at' | 'outlet'> & { id?: string; created_at?: string };
        Update: Partial<Omit<AppUser, 'id' | 'created_at' | 'outlet'>>;
      };
      menu_items: {
        Row: MenuItem;
        Insert: Omit<MenuItem, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<MenuItem, 'id' | 'created_at'>>;
      };
      orders: {
        Row: Order;
        Insert: {
          id?: string;
          outlet_id: string;
          customer_name?: string;
          customer_phone?: string;
          items?: any;
          total: number;
          status?: OrderStatus | string;
          pickup_code?: string;
          payment_id?: string | null;
          kitchen_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          outlet_id?: string;
          customer_name?: string;
          customer_phone?: string;
          items?: any;
          total?: number;
          status?: OrderStatus | string;
          pickup_code?: string;
          payment_id?: string | null;
          kitchen_note?: string | null;
          updated_at?: string;
        };
      };
    };
  };
};
