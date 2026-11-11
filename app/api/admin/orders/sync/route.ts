import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAndSyncOrder } from '@/lib/order-sync';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { outletId } = body;

    let sql = `
      SELECT id, outlet_id, status, payment_status, cf_order_id, created_at
      FROM public.orders
      WHERE status = 'pending_payment'
    `;
    const params: unknown[] = [];

    if (outletId && outletId !== 'all') {
      params.push(outletId);
      sql += ` AND outlet_id = $${params.length}`;
    }

    sql += ` ORDER BY created_at ASC`;

    const res = await query(sql, params);
    const pendingOrders = res.rows;

    let paidCount = 0;
    let notPaidCount = 0;
    let expiredCount = 0;

    for (const order of pendingOrders) {
      try {
        const syncRes = await verifyAndSyncOrder(order);
        if (syncRes.paid) {
          paidCount++;
        } else {
          notPaidCount++;
          if (syncRes.expired) {
            expiredCount++;
          }
        }
      } catch (err) {
        console.error(`Sync error on order ${order.id}:`, err);
        notPaidCount++;
      }
    }

    const checked = pendingOrders.length;
    const message = `Checked ${checked} orders: ${paidCount} paid, ${notPaidCount} not paid`;

    return NextResponse.json({
      success: true,
      checked,
      paid: paidCount,
      notPaid: notPaidCount,
      expired: expiredCount,
      message,
    });
  } catch (error: any) {
    console.error('Admin sync orders error:', error);
    return NextResponse.json({ error: error?.message || 'Sync failed' }, { status: 500 });
  }
}
