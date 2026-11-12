import { CartItem, CustomerDetails, MenuItem, Order, OrderStatus, Outlet } from '@/types';
import { supabase } from './supabase';
import { generateOrderId, generatePickupCode } from './utils';
import { getOutletAvailability } from './outlets';
import { resolveImageUrl, DEFAULT_MENU_IMAGE } from '@/lib/images';

// In-memory menu cache to prevent redundant Supabase queries during user navigation
const cachedMenus: Record<string, MenuItem[]> = {};

export async function getOutlets(): Promise<Outlet[]> {
  try {
    const res = await fetch('/api/outlets', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return [];
    const payload = await res.json();
    const rows = Array.isArray(payload?.outlets) ? payload.outlets : [];

    return rows
      .filter((o: any) => o.is_active === true)
      .map((o: any) => {
        const availability = getOutletAvailability(
          o.opening_time,
          o.closing_time,
          Boolean(o.is_active)
        );
        return {
          id: o.id,
          name: o.name,
          address: o.address || '',
          isOpen: availability.isOpen,
          is_active: Boolean(o.is_active),
          statusText: availability.statusText,
          openingTime: o.opening_time || '15:00',
          closingTime: o.closing_time || '00:00',
        };
      });
  } catch (err) {
    console.error('Error fetching outlets:', err);
    return [];
  }
}

export async function getOutletById(id: string): Promise<Outlet | null> {
  const outlets = await getOutlets();
  return outlets.find((o) => o.id === id) || null;
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
      image: resolveImageUrl(item.image_url, 'hero') || DEFAULT_MENU_IMAGE,
      image_url: resolveImageUrl(item.image_url, 'hero') || DEFAULT_MENU_IMAGE,
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
      image: resolveImageUrl(item.image_url, 'hero') || DEFAULT_MENU_IMAGE,
      image_url: resolveImageUrl(item.image_url, 'hero') || DEFAULT_MENU_IMAGE,
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

// Function to clear cache if needed
export function clearApiCache() {
  for (const k of Object.keys(cachedMenus)) {
    delete cachedMenus[k];
  }
}
