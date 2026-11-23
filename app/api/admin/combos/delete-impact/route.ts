import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validatePortalAdmin } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'single';

    if (!id) {
      return NextResponse.json({ error: 'Combo ID is required' }, { status: 400 });
    }

    const auth = await validatePortalAdmin(req);
    if (!auth.ok) return auth.response;

    // Fetch the target combo
    const comboRes = await query(
      `SELECT c.*, o.name AS outlet_name
       FROM public.combos c
       LEFT JOIN public.outlets o ON c.outlet_id = o.id
       WHERE c.id = $1 AND c.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (comboRes.rows.length === 0) {
      return NextResponse.json({ error: 'Combo not found' }, { status: 404 });
    }

    const combo = comboRes.rows[0];
    const isShared = combo.master_combo_id !== null;

    if (scope === 'all') {
      if (!isShared) {
        return NextResponse.json({
          ok: false,
          error: `"${combo.name}" is an outlet-only combo for ${combo.outlet_name || 'a single outlet'}. Please select that outlet to delete it.`,
          isOutletOnlyInAllView: true,
          outletName: combo.outlet_name,
        });
      }

      // Count live outlets that currently have this master_combo_id
      const outletsRes = await query(
        `SELECT DISTINCT o.id, o.name
         FROM public.combos c
         JOIN public.outlets o ON c.outlet_id = o.id
         WHERE c.master_combo_id = $1 AND c.deleted_at IS NULL
         ORDER BY o.name ASC`,
        [combo.master_combo_id]
      );

      return NextResponse.json({
        ok: true,
        comboName: combo.name,
        isShared: true,
        scope: 'all',
        outletsCount: outletsRes.rows.length,
        outletNames: outletsRes.rows.map((o: any) => o.name),
      });
    } else {
      return NextResponse.json({
        ok: true,
        comboName: combo.name,
        isShared,
        scope: 'single',
        outletName: combo.outlet_name || 'this outlet',
      });
    }
  } catch (err: any) {
    console.error('combo delete-impact error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
