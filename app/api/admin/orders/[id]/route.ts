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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const caller = await getCallerUser(req);
    const allowedRoles = ['admin', 'super_admin', 'manager'];
    if (!caller.role || !allowedRoles.includes(caller.role)) {
      return NextResponse.json(
        { error: 'Forbidden: only admin and manager can delete orders' },
        { status: 403 }
      );
    }

    const orderRes = await query('SELECT * FROM public.orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // Manager can only delete orders from their own outlet
    if (caller.role === 'manager' && caller.outletId && order.outlet_id !== caller.outletId) {
      return NextResponse.json(
        { error: 'Forbidden: you can only delete orders from your outlet' },
        { status: 403 }
      );
    }

    // Only statuses cancelled, payment_cancelled and payment_failed can ever be deleted
    const deletableStatuses = ['cancelled', 'payment_cancelled', 'payment_failed'];
    if (!deletableStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Cannot delete order with status '${order.status}'. Only cancelled orders can be deleted.`,
        },
        { status: 400 }
      );
    }

    await query('DELETE FROM public.orders WHERE id = $1', [orderId]);

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
      orderId,
    });
  } catch (error: any) {
    console.error('Delete order error:', error);
    return NextResponse.json({ error: error?.message || 'Delete failed' }, { status: 500 });
  }
}
