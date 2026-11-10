import { CartItem, CustomerDetails, MenuItem, Order, OrderStatus, Outlet } from '@/types';
import { supabase } from './supabase';
import { generateOrderId, generatePickupCode } from './utils';

export async function getOutlets(): Promise<Outlet[]> {
  try {
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .order('name');

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((o: any) => ({
      id: o.id,
      name: o.name,
      address: o.address || 'Kerala',
      distance: '0.8 km',
      isOpen: o.is_active ?? true,
      is_active: o.is_active ?? true,
      statusText: o.is_active ? 'Open now' : 'Closed',
      openingTime: o.opening_time || '15:00',
      closingTime: o.closing_time || '00:00',
    }));
  } catch (err) {
    console.error('Error fetching outlets from Supabase:', err);
    return [];
  }
}

export async function getOutletById(id: string): Promise<Outlet | null> {
  try {
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const o: any = data;

    return {
      id: o.id,
      name: o.name,
      address: o.address || 'Kerala',
      distance: '0.8 km',
      isOpen: o.is_active ?? true,
      is_active: o.is_active ?? true,
      statusText: o.is_active ? 'Open now' : 'Closed',
      openingTime: o.opening_time || '15:00',
      closingTime: o.closing_time || '00:00',
    };
  } catch {
    return null;
  }
}

export async function getMenu(outletId?: string): Promise<MenuItem[]> {
  try {
    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (outletId) {
      query = query.eq('outlet_id', outletId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category || 'Chai & Coffee',
      price: Number(item.price),
      description: item.description || '',
      image: item.image_url || '/assets/chai.jpg',
      image_url: item.image_url || '/assets/chai.jpg',
      isVeg: item.is_veg ?? true,
      is_veg: item.is_veg ?? true,
      isBestseller: item.is_bestseller ?? false,
      is_bestseller: item.is_bestseller ?? false,
      outlet_id: item.outlet_id,
    }));
  } catch (err) {
    console.error('Error fetching menu items:', err);
    return [];
  }
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const item: any = data;

    return {
      id: item.id,
      name: item.name,
      category: item.category || 'Chai & Coffee',
      price: Number(item.price),
      description: item.description || '',
      image: item.image_url || '/assets/chai.jpg',
      image_url: item.image_url || '/assets/chai.jpg',
      isVeg: item.is_veg ?? true,
      is_veg: item.is_veg ?? true,
      isBestseller: item.is_bestseller ?? false,
      is_bestseller: item.is_bestseller ?? false,
      outlet_id: item.outlet_id,
    };
  } catch {
    return null;
  }
}

export interface CreateOrderPayload {
  outlet: Outlet;
  items: CartItem[];
  customer: CustomerDetails;
  paymentMethod: string;
  itemTotal: number;
  gst: number;
  grandTotal: number;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const now = Date.now();
  const orderId = generateOrderId();
  const code = generatePickupCode();

  const newOrder: Order = {
    id: orderId,
    code,
    placedAt: now,
    estimatedReadyTime: 'Ready in 15-20 min',
    paidAmount: payload.grandTotal,
    paymentMethod: payload.paymentMethod,
    status: 'placed',
    outlet: payload.outlet,
    items: payload.items,
    itemTotal: payload.itemTotal,
    gst: 0,
    grandTotal: payload.grandTotal,
    customer: payload.customer,
    statusHistory: {
      placedAt: now,
    },
  };

  return newOrder;
}
