import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import pool, { query } from '@/lib/db';
import { validatePortalManagerOrAdmin } from '@/lib/portal-auth';
import { MAX_BESTSELLERS } from '@/lib/menu-categories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateBestsellers() {
  try {
    revalidatePath('/menu');
    revalidatePath('/api/menu');
    revalidatePath('/admin/bestsellers');
  } catch (err) {
    console.warn('revalidatePath notice:', err);
  }
}

async function fetchOutletBestsellers(outletId: string) {
  const bsRes = await query(
    `SELECT ob.id AS bestseller_row_id, ob.sort_order AS bestseller_sort_order,
            m.id, m.outlet_id, m.name, m.description, m.price, m.category,
            m.image_url, m.is_available, m.is_veg,
            c.sort_order AS category_sort_order
     FROM public.outlet_bestsellers ob
     INNER JOIN public.menu_items m ON ob.item_id = m.id
     LEFT JOIN public.categories c ON m.category = c.name
     WHERE ob.outlet_id = $1::uuid
       AND m.outlet_id = $1::uuid
       AND m.is_available = true
     ORDER BY ob.sort_order ASC, ob.created_at ASC
     LIMIT $2`,
    [outletId, MAX_BESTSELLERS]
  );
  return bsRes.rows;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedOutletId = (searchParams.get('outlet_id') || searchParams.get('outlet') || '').trim();

    const auth = await validatePortalManagerOrAdmin(req, requestedOutletId || undefined);
    if (!auth.ok) return auth.response;

    const { ctx } = auth;
    const targetOutletId = ctx.isManager ? ctx.userOutletId : requestedOutletId;

    if (!targetOutletId || !UUID_REGEX.test(targetOutletId)) {
      return NextResponse.json(
        { error: 'Valid outlet_id query parameter is required' },
        { status: 400 }
      );
    }

    const [bestsellers, outletItemsRes] = await Promise.all([
      fetchOutletBestsellers(targetOutletId),
      query(
        `SELECT m.id, m.outlet_id, m.name, m.description, m.price, m.category,
                m.image_url, m.is_available, m.is_veg, m.sort_order,
                c.sort_order AS category_sort_order
         FROM public.menu_items m
         LEFT JOIN public.categories c ON m.category = c.name
         WHERE m.outlet_id = $1::uuid
         ORDER BY COALESCE(c.sort_order, 999) ASC, m.sort_order ASC, m.name ASC`,
        [targetOutletId]
      ),
    ]);

    return NextResponse.json(
      {
        outlet_id: targetOutletId,
        max_bestsellers: MAX_BESTSELLERS,
        bestsellers,
        outlet_items: outletItemsRes.rows,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Portal bestsellers GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load bestsellers' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawOutletId = String(body?.outlet_id || '').trim();

    const auth = await validatePortalManagerOrAdmin(req, rawOutletId || undefined);
    if (!auth.ok) return auth.response;

    const { ctx } = auth;
    const targetOutletId = ctx.isManager ? ctx.userOutletId : rawOutletId;

    if (!targetOutletId || !UUID_REGEX.test(targetOutletId)) {
      return NextResponse.json({ error: 'Valid outlet_id is required' }, { status: 400 });
    }

    if (!Array.isArray(body?.item_ids)) {
      return NextResponse.json({ error: 'item_ids array is required' }, { status: 400 });
    }

    // Deduplicate item IDs while preserving chosen sort order
    const seen = new Set<string>();
    const itemIds: string[] = [];
    for (const raw of body.item_ids) {
      const id = String(raw || '').trim();
      if (!UUID_REGEX.test(id)) {
        return NextResponse.json({ error: `Invalid item id: ${id}` }, { status: 400 });
      }
      if (!seen.has(id)) {
        seen.add(id);
        itemIds.push(id);
      }
    }

    if (itemIds.length > MAX_BESTSELLERS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BESTSELLERS} bestsellers allowed per outlet` },
        { status: 400 }
      );
    }

    // Validate every item belongs to targetOutletId and is available
    if (itemIds.length > 0) {
      const checkRes = await query(
        `SELECT id
         FROM public.menu_items
         WHERE outlet_id = $1::uuid
           AND is_available = true
           AND id = ANY($2::uuid[])`,
        [targetOutletId, itemIds]
      );
      if (checkRes.rows.length !== itemIds.length) {
        return NextResponse.json(
          { error: 'One or more selected items are unavailable or do not belong to this outlet' },
          { status: 400 }
        );
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM public.outlet_bestsellers WHERE outlet_id = $1::uuid', [
        targetOutletId,
      ]);
      for (let i = 0; i < itemIds.length; i++) {
        await client.query(
          `INSERT INTO public.outlet_bestsellers (outlet_id, item_id, sort_order)
           VALUES ($1::uuid, $2::uuid, $3)`,
          [targetOutletId, itemIds[i], i]
        );
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    revalidateBestsellers();
    const updated = await fetchOutletBestsellers(targetOutletId);

    return NextResponse.json(
      {
        outlet_id: targetOutletId,
        max_bestsellers: MAX_BESTSELLERS,
        bestsellers: updated,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Portal bestsellers PUT error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save bestsellers' },
      { status: 500 }
    );
  }
}
