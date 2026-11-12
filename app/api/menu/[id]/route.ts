import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { resolveImageUrl, DEFAULT_MENU_IMAGE } from '@/lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_REGEX.test(id || '')) {
      return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
    }

    const res = await query(
      `SELECT m.id, m.outlet_id, m.name, m.description, m.price, m.category,
              c.slug AS category_slug, c.sort_order AS category_sort_order,
              m.image_url, m.is_available, m.is_veg, m.sort_order,
              EXISTS (
                SELECT 1 FROM public.outlet_bestsellers ob
                WHERE ob.outlet_id = m.outlet_id AND ob.item_id = m.id
              ) AS is_outlet_bestseller
       FROM public.menu_items m
       INNER JOIN public.categories c ON m.category = c.name
       WHERE m.id = $1::uuid
         AND m.is_available = true
       LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const row = res.rows[0];
    const isBestseller = Boolean(row.is_outlet_bestseller);

    return NextResponse.json(
      {
        item: {
          id: row.id,
          outlet_id: row.outlet_id,
          name: row.name,
          description: row.description || '',
          price: Number(row.price),
          category: row.category,
          category_slug: row.category_slug,
          category_sort_order: Number(row.category_sort_order || 999),
          image: resolveImageUrl(row.image_url, 'hero') || DEFAULT_MENU_IMAGE,
          image_url: resolveImageUrl(row.image_url, 'hero') || DEFAULT_MENU_IMAGE,
          isVeg: row.is_veg ?? true,
          is_veg: row.is_veg ?? true,
          isBestseller,
          is_bestseller: isBestseller,
          is_available: row.is_available ?? true,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error: any) {
    console.error('Public menu item detail fetch error:', error);
    return NextResponse.json({ error: 'Failed to load item' }, { status: 500 });
  }
}
