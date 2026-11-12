export type UserRole = 'super_admin' | 'admin' | 'manager' | 'staff' | 'ordering_staff';

export interface Outlet {
  id: string;
  name: string;
  address: string | null;
  phone?: string | null;
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
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'packaging'
  | 'ready'
  | 'completed'
  | 'received'
  | 'cancelled'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'accepted'
  | 'picked_up';

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
  cf_order_id?: string | null;
  cf_payment_id?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  confirmed_at?: string | null;
  making_at?: string | null;
  packaging_at?: string | null;
  ready_at?: string | null;
  received_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  refund_required?: boolean | null;
  refund_done?: boolean | null;
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
          cf_order_id?: string | null;
          cf_payment_id?: string | null;
          payment_status?: string | null;
          payment_method?: string | null;
          paid_at?: string | null;
          confirmed_at?: string | null;
          making_at?: string | null;
          packaging_at?: string | null;
          ready_at?: string | null;
          received_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          cancelled_by?: string | null;
          refund_required?: boolean | null;
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
          cf_order_id?: string | null;
          cf_payment_id?: string | null;
          payment_status?: string | null;
          payment_method?: string | null;
          paid_at?: string | null;
          confirmed_at?: string | null;
          making_at?: string | null;
          packaging_at?: string | null;
          ready_at?: string | null;
          received_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          cancelled_by?: string | null;
          refund_required?: boolean | null;
          kitchen_note?: string | null;
          updated_at?: string;
        };
      };
      app_settings: {
        Row: {
          id: string;
          key: string;
          value: any;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          value: any;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          key?: string;
          value?: any;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
    };
  };
};
