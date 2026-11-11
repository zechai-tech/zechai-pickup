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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const caller = await getCallerUser(req, body);

    const allowedRoles = ['admin', 'super_admin', 'manager'];
    if (!caller.role || !allowedRoles.includes(caller.role)) {
      return NextResponse.json(
        { error: 'Forbidden: only admin and manager can delete orders' },
        { status: 403 }
      );
    }

    let targetOutletId = body.outlet_id;
    if (caller.role === 'manager') {
      targetOutletId = caller.outletId;
      if (!targetOutletId) {
        return NextResponse.json({ error: 'Manager has no assigned outlet' }, { status: 403 });
      }
    }

    let sql = `
      SELECT id, refund_required, refund_done
      FROM public.orders
      WHERE status IN ('cancelled', 'payment_cancelled', 'payment_failed')
    `;
    const params: unknown[] = [];

    if (targetOutletId && targetOutletId !== 'all') {
      params.push(targetOutletId);
      sql += ` AND outlet_id = $${params.length}`;
    }

    const res = await query(sql, params);
    const cancelledOrders = res.rows;

    if (cancelledOrders.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        skippedCount: 0,
        message: 'No cancelled orders found to delete',
      });
    }

    // SAFETY: orders with refund_required = true AND refund_done = false are NEVER deleted by Delete All.
    const toDeleteIds: string[] = [];
    let skippedCount = 0;

    for (const ord of cancelledOrders) {
      const needsRefund = Boolean(ord.refund_required) && !Boolean(ord.refund_done);
      if (needsRefund) {
        skippedCount++;
      } else {
        toDeleteIds.push(ord.id);
      }
    }

    if (toDeleteIds.length > 0) {
      await query(`DELETE FROM public.orders WHERE id = ANY($1::uuid[])`, [toDeleteIds]);
    }

    const deletedCount = toDeleteIds.length;
    let message = `Deleted ${deletedCount} orders`;
    if (skippedCount > 0) {
      message = `Deleted ${deletedCount}. Skipped ${skippedCount} order${
        skippedCount > 1 ? 's' : ''
      } that still need${skippedCount === 1 ? 's' : ''} a refund.`;
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      skippedCount,
      message,
    });
  } catch (error: any) {
    console.error('Delete cancelled orders error:', error);
    return NextResponse.json({ error: error?.message || 'Delete cancelled failed' }, { status: 500 });
  }
}
