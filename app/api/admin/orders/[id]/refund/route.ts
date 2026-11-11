import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getCallerUser(req: NextRequest, body?: any) {
  let role = body?.caller_role;
  let outletId = body?.caller_outlet_id;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      if (user?.email) {
        const res = await query('SELECT role, outlet_id FROM public.users WHERE email = $1', [
          user.email.toLowerCase(),
        ]);
        if (res.rows.length > 0) {
          role = res.rows[0].role;
          outletId = res.rows[0].outlet_id;
        }
      }
    } catch {}
  }

  return { role, outletId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const caller = await getCallerUser(req, body);

    const allowedRoles = ['admin', 'super_admin', 'manager'];
    if (!caller.role || !allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const orderRes = await query('SELECT * FROM public.orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];
    if (caller.role === 'manager' && caller.outletId && order.outlet_id !== caller.outletId) {
      return NextResponse.json(
        { error: 'Forbidden: you can only update orders from your outlet' },
        { status: 403 }
      );
    }

    const updateRes = await query(
      `UPDATE public.orders
       SET refund_done = true, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      message: 'Refund marked as done',
      order: updateRes.rows[0],
    });
  } catch (error: any) {
    console.error('Refund update error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update refund status' },
      { status: 500 }
    );
  }
}
