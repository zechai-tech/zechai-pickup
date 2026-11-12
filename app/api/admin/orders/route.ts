import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outlet_id');
    const status = searchParams.get('status');

    let sql = `
      SELECT o.*,
             COALESCE(ot.name, NULLIF(o.outlet_name, ''), 'Deleted outlet') as outlet_name,
             json_build_object(
               'id', ot.id,
               'name', COALESCE(ot.name, NULLIF(o.outlet_name, ''), 'Deleted outlet'),
               'address', ot.address
             ) as outlet
      FROM public.orders o
      LEFT JOIN public.outlets ot ON o.outlet_id = ot.id
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (outletId) {
      params.push(outletId);
      conditions.push(`o.outlet_id = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY o.created_at DESC';

    const res = await query(sql, params);
    return NextResponse.json({ orders: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Order ID and status are required' }, { status: 400 });
    }

    const res = await query(
      `
      UPDATE public.orders
      SET status = $1, updated_at = now()
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    return NextResponse.json({ order: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
