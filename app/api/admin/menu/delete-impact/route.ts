import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validatePortalManagerOrAdmin } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'single';
    const outletId = searchParams.get('outlet_id') || undefined;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const auth = await validatePortalManagerOrAdmin(req, outletId);
    if (!auth.ok) return auth.response;

    const { ctx } = auth;

    // Fetch the target item
    const itemRes = await query(
      `SELECT m.*, o.name AS outlet_name
       FROM public.menu_items m
       LEFT JOIN public.outlets o ON m.outlet_id = o.id
       WHERE m.id = $1 AND m.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (itemRes.rows.length === 0) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    const item = itemRes.rows[0];
    const isShared = item.master_item_id !== null;

    // Permissions check for managers
    if (ctx.isManager) {
      if (isShared) {
        return NextResponse.json(
          { error: 'Forbidden: managers cannot delete shared menu items' },
          { status: 403 }
        );
      }
      if (item.outlet_id !== ctx.userOutletId) {
        return NextResponse.json(
          { error: 'Forbidden: managers can only delete items in their own outlet' },
          { status: 403 }
        );
      }
    }

    if (scope === 'all') {
      if (!ctx.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: only admins can delete from all outlets' },
          { status: 403 }
        );
      }

      if (!isShared) {
        return NextResponse.json({
          ok: false,
          error: `"${item.name}" is an outlet-only item for ${item.outlet_name || 'a single outlet'}. Please select that outlet to delete it.`,
          isOutletOnlyInAllView: true,
          outletName: item.outlet_name,
        });
      }

      // Count live outlets that currently have this master_item_id
      const outletsRes = await query(
        `SELECT DISTINCT o.id, o.name
         FROM public.menu_items m
         JOIN public.outlets o ON m.outlet_id = o.id
         WHERE m.master_item_id = $1 AND m.deleted_at IS NULL
         ORDER BY o.name ASC`,
        [item.master_item_id]
      );

      const outletsCount = outletsRes.rows.length;
      const outletNames = outletsRes.rows.map((o: any) => o.name);

      // Find all live combos across all outlets that use any copy of this shared item
      const combosRes = await query(
        `SELECT DISTINCT c.id, c.name, o.name AS outlet_name
         FROM public.combos c
         JOIN public.combo_items ci ON c.id = ci.combo_id
         JOIN public.menu_items m ON ci.menu_item_id = m.id
         LEFT JOIN public.outlets o ON c.outlet_id = o.id
         WHERE m.master_item_id = $1
           AND c.deleted_at IS NULL
           AND m.deleted_at IS NULL
         ORDER BY c.name ASC, o.name ASC`,
        [item.master_item_id]
      );

      return NextResponse.json({
        ok: true,
        itemName: item.name,
        isShared: true,
        scope: 'all',
        outletsCount,
        outletNames,
        affectedCombos: combosRes.rows,
      });
    } else {
      // Scope === 'single'
      const outletName = item.outlet_name || 'this outlet';

      // Find all live combos in this specific outlet that use this item
      const combosRes = await query(
        `SELECT DISTINCT c.id, c.name, o.name AS outlet_name
         FROM public.combos c
         JOIN public.combo_items ci ON c.id = ci.combo_id
         LEFT JOIN public.outlets o ON c.outlet_id = o.id
         WHERE ci.menu_item_id = $1
           AND c.deleted_at IS NULL
         ORDER BY c.name ASC`,
        [item.id]
      );

      return NextResponse.json({
        ok: true,
        itemName: item.name,
        isShared,
        scope: 'single',
        outletName,
        affectedCombos: combosRes.rows,
      });
    }
  } catch (err: any) {
    console.error('delete-impact error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
