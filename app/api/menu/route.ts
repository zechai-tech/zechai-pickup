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

    // 4. Fetch combos for this outlet (if any)
    let combos: any[] = [];
    try {
      const combosRes = await query(
        `SELECT c.* FROM public.combos c WHERE c.outlet_id = $1::uuid ORDER BY c.sort_order ASC, c.created_at DESC`,
        [outletId]
      );
      if (combosRes.rows.length > 0) {
        const comboIds = combosRes.rows.map((c: any) => c.id);
        const comboItemsRes = await query(
          `SELECT ci.combo_id, ci.menu_item_id, ci.quantity,
                  m.name, m.price, m.image_url, m.is_available, m.is_veg
           FROM public.combo_items ci
           JOIN public.menu_items m ON ci.menu_item_id = m.id
           WHERE ci.combo_id = ANY($1)
           ORDER BY ci.created_at ASC`,
          [comboIds]
        );

        const itemsByCombo = new Map<string, any[]>();
        for (const row of comboItemsRes.rows) {
          const list = itemsByCombo.get(row.combo_id) || [];
          list.push({
            menu_item_id: row.menu_item_id,
            name: row.name,
            price: Number(row.price),
            quantity: Number(row.quantity),
            image_url: row.image_url,
            is_available: row.is_available ?? true,
            is_veg: row.is_veg ?? true,
          });
          itemsByCombo.set(row.combo_id, list);
        }

        combos = combosRes.rows.map((c: any) => {
          const included = itemsByCombo.get(c.id) || [];
          const isAvailable = included.length > 0 && included.every((i: any) => i.is_available === true);
          const isVeg = included.every((i: any) => i.is_veg === true);
          const itemsTotal = included.reduce(
            (sum: number, i: any) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
            0
          );
          const price = Number(c.price);
          const savings = Math.max(0, itemsTotal - price);

          return {
            id: c.id,
            outlet_id: c.outlet_id,
            name: c.name,
            description: c.description || '',
            price: price,
            image: resolveImageUrl(c.image_url, 'tile') || DEFAULT_MENU_IMAGE,
            image_url: resolveImageUrl(c.image_url, 'tile') || DEFAULT_MENU_IMAGE,
            is_available: isAvailable,
            is_veg: isVeg,
            items_total: itemsTotal,
            savings: savings,
            items: included,
            sort_order: Number(c.sort_order || 0),
          };
        });
      }
    } catch (comboErr) {
      console.warn('Notice: could not load combos (table may not exist yet):', comboErr);
    }

    return NextResponse.json(
      {
        menu_theme: menuTheme,
        categories,
        bestsellers,
        bestseller_ids: bestsellerIds,
        items,
        combos,
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
