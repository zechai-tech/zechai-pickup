import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { MAX_BESTSELLERS } from '@/lib/menu-categories';
import { resolveImageUrl, DEFAULT_MENU_IMAGE } from '@/lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatCustomerMenuItem(row: any, bestsellerSet: Set<string>, variant: 'tile' | 'thumb' = 'thumb') {
  const isBestseller = bestsellerSet.has(row.id);
  return {
    id: row.id,
    outlet_id: row.outlet_id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    category: row.category,
    category_slug: row.category_slug,
    category_sort_order: Number(row.category_sort_order || 999),
    image: resolveImageUrl(row.image_url, variant) || DEFAULT_MENU_IMAGE,
    image_url: resolveImageUrl(row.image_url, variant) || DEFAULT_MENU_IMAGE,
    isVeg: row.is_veg ?? true,
    is_veg: row.is_veg ?? true,
    isBestseller,
    is_bestseller: isBestseller,
    is_available: row.is_available ?? true,
    sort_order: Number(row.sort_order || 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = (searchParams.get('outlet') || searchParams.get('outlet_id') || '').trim();

    if (!UUID_REGEX.test(outletId)) {
      return NextResponse.json(
        { error: 'Valid outlet query parameter is required' },
        { status: 400 }
      );
    }

    // 0. Fetch outlet's active menu_theme ('classic' | 'grid')
    const outletThemeRes = await query(
      `SELECT menu_theme FROM public.outlets WHERE id = $1::uuid LIMIT 1`,
      [outletId]
    );
    const menuTheme = outletThemeRes.rows[0]?.menu_theme === 'grid' ? 'grid' : 'classic';

    // 1. Fetch curated per-outlet bestsellers (only available + categorized items)
    const bsRes = await query(
      `SELECT m.id, m.outlet_id, m.name, m.description, m.price, m.category,
              c.slug AS category_slug, c.sort_order AS category_sort_order,
              m.image_url, m.is_available, m.is_veg, m.sort_order
       FROM public.outlet_bestsellers ob
       INNER JOIN public.menu_items m ON ob.item_id = m.id
       INNER JOIN public.categories c ON m.category = c.name
       WHERE ob.outlet_id = $1::uuid
         AND m.outlet_id = $1::uuid
         AND m.is_available = true
       ORDER BY ob.sort_order ASC, ob.created_at ASC
       LIMIT $2`,
      [outletId, MAX_BESTSELLERS]
    );

    const bestsellerIds = bsRes.rows.map((r: any) => String(r.id));
    const bestsellerSet = new Set<string>(bestsellerIds);

    // 2. Fetch all available & categorized items for this outlet sorted by fixed category order
    const itemsRes = await query(
      `SELECT m.id, m.outlet_id, m.name, m.description, m.price, m.category,
              c.slug AS category_slug, c.sort_order AS category_sort_order,
              m.image_url, m.is_available, m.is_veg, m.sort_order
       FROM public.menu_items m
       INNER JOIN public.categories c ON m.category = c.name
       WHERE m.outlet_id = $1::uuid
         AND m.is_available = true
       ORDER BY c.sort_order ASC, m.sort_order ASC, m.created_at ASC`,
      [outletId]
    );

    // 3. Derive ONLY non-empty categories in exact category sort_order (1..12)
    const seenCategories = new Map<string, { name: string; slug: string; sort_order: number }>();
    for (const row of itemsRes.rows) {
      if (!seenCategories.has(row.category)) {
        seenCategories.set(row.category, {
          name: row.category,
          slug: row.category_slug,
          sort_order: Number(row.category_sort_order),
        });
      }
    }

    const categories = Array.from(seenCategories.values()).sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const bestsellers = bsRes.rows.map((r: any) => formatCustomerMenuItem(r, bestsellerSet, 'tile'));
    const items = itemsRes.rows.map((r: any) => formatCustomerMenuItem(r, bestsellerSet, 'thumb'));

    return NextResponse.json(
      {
        menu_theme: menuTheme,
        categories,
        bestsellers,
        bestseller_ids: bestsellerIds,
        items,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error: any) {
    console.error('Public menu fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to load menu' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }
}
