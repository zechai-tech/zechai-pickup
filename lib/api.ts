import { CartItem, CustomerDetails, MenuItem, Order, OrderStatus, Outlet } from '@/types';
import { supabase } from './supabase';
import { generateOrderId, generatePickupCode } from './utils';

// In-memory caches to prevent redundant Supabase queries during user navigation
let cachedOutlets: Outlet[] | null = null;
const cachedMenus: Record<string, MenuItem[]> = {};

export async function getOutlets(): Promise<Outlet[]> {
  if (cachedOutlets && cachedOutlets.length > 0) {
    return cachedOutlets;
  }

  try {
    const { data, error } = await supabase
      .from('outlets')
      .select('id, name, address, phone, is_active, opening_time, closing_time, latitude, longitude')
      .order('name');

    if (error || !data || data.length === 0) {
      return [];
    }

    const outlets = data.map((o: any) => ({
      id: o.id,
      name: o.name,
      address: o.address || 'Kerala',
      phone: o.phone || null,
      latitude: o.latitude ? Number(o.latitude) : null,
      longitude: o.longitude ? Number(o.longitude) : null,
      distance: '1.2 km',
      isOpen: o.is_active ?? true,
      is_active: o.is_active ?? true,
      statusText: o.is_active ? 'Open now' : 'Closed',
      openingTime: o.opening_time || '15:00',
      closingTime: o.closing_time || '00:00',
    }));

    cachedOutlets = outlets;
    return outlets;
  } catch (err) {
    console.error('Error fetching outlets from Supabase:', err);
    return [];
  }
}

export async function getOutletById(id: string): Promise<Outlet | null> {
  const outlets = await getOutlets();
  const match = outlets.find((o) => o.id === id);
  if (match) return match;

  try {
    const { data, error } = await supabase
      .from('outlets')
      .select('id, name, address, phone, is_active, opening_time, closing_time, latitude, longitude')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    const o: any = data;

    return {
      id: o.id,
      name: o.name,
      address: o.address || 'Kerala',
      phone: o.phone || null,
      latitude: o.latitude ? Number(o.latitude) : null,
      longitude: o.longitude ? Number(o.longitude) : null,
      distance: '1.2 km',
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
  const cacheKey = outletId || 'all';
  if (cachedMenus[cacheKey] && cachedMenus[cacheKey].length > 0) {
    return cachedMenus[cacheKey];
  }

  try {
    let query = supabase
      .from('menu_items')
      .select('id, name, description, price, category, image_url, is_veg, is_bestseller, is_available, outlet_id, sort_order')
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (outletId) {
      query = query.eq('outlet_id', outletId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    const items = data.map((item: any) => ({
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

    cachedMenus[cacheKey] = items;
    return items;
  } catch (err) {
    console.error('Error fetching menu items:', err);
    return [];
  }
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  // Search in memory caches first
  for (const menuList of Object.values(cachedMenus)) {
    const found = menuList.find((i) => i.id === id);
    if (found) return found;
  }

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, description, price, category, image_url, is_veg, is_bestseller, is_available, outlet_id')
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

// Function to clear cache if needed (e.g. after outlet changes)
export function clearApiCache() {
  cachedOutlets = null;
  for (const k of Object.keys(cachedMenus)) {
    delete cachedMenus[k];
  }
}
