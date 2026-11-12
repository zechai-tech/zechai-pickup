import { MenuItem, Outlet } from '@/types';
import { getOutletAvailability } from './outlets';
import { MenuCategoryDef } from './menu-categories';

export interface CustomerMenuResponse {
  categories: MenuCategoryDef[];
  bestsellers: MenuItem[];
  bestseller_ids: string[];
  items: MenuItem[];
}

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

export async function getOutletMenuData(outletId: string): Promise<CustomerMenuResponse> {
  if (!outletId) {
    return { categories: [], bestsellers: [], bestseller_ids: [], items: [] };
  }

  try {
    const res = await fetch(`/api/menu?outlet=${encodeURIComponent(outletId)}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) {
      return { categories: [], bestsellers: [], bestseller_ids: [], items: [] };
    }
    const data = await res.json();
    return {
      categories: Array.isArray(data.categories) ? data.categories : [],
      bestsellers: Array.isArray(data.bestsellers) ? data.bestsellers : [],
      bestseller_ids: Array.isArray(data.bestseller_ids) ? data.bestseller_ids : [],
      items: Array.isArray(data.items) ? data.items : [],
    };
  } catch (err) {
    console.error('Error fetching menu data:', err);
    return { categories: [], bestsellers: [], bestseller_ids: [], items: [] };
  }
}

export async function getMenu(outletId?: string): Promise<MenuItem[]> {
  if (!outletId) return [];
  const data = await getOutletMenuData(outletId);
  return data.items;
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  if (!id) return null;
  try {
    const res = await fetch(`/api/menu/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.item || null;
  } catch {
    return null;
  }
}

export function clearApiCache() {
  // No client-side outlet/menu cache retained; routes serve live no-store data
}
