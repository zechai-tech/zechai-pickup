import { NextRequest, NextResponse } from 'next/server';
import { verifyAndSyncOrder } from '@/lib/order-sync';
import { query } from '@/lib/db';

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export async function POST(req: NextRequest) {
  try {
    const { orderId, pickupCode, isReturnCheck } = await req.json().catch(() => ({}));

    if (!orderId && !pickupCode) {
      return NextResponse.json({ error: 'Order ID or pickup code is required' }, { status: 400 });
    }

    let targetOrderId = orderId;

    if (orderId && !isUuid(orderId)) {
      const res = await query(
        `SELECT id FROM public.orders WHERE cf_order_id = $1 LIMIT 1`,
        [orderId]
      );
      if (res.rows.length > 0) {
        targetOrderId = res.rows[0].id;
      }
    }

    if (!targetOrderId && pickupCode) {
      const res = await query(
        `SELECT id, status, payment_status, cf_order_id, created_at 
         FROM public.orders 
         WHERE pickup_code = $1 
         ORDER BY created_at DESC LIMIT 1`,
        [pickupCode]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      targetOrderId = res.rows[0].id;
    }

    const result = await verifyAndSyncOrder(targetOrderId, {
      isReturnCheck: !!isReturnCheck,
    });

    // Fetch refreshed order details
    const orderRes = await query(
      `SELECT o.id, o.status, o.payment_status, o.pickup_code, o.total, o.items, o.payment_method,
              COALESCE(o.paid_at, CASE WHEN o.payment_status = 'success' THEN o.created_at ELSE NULL END) as paid_at,
              o.created_at,
              COALESCE(ot.name, NULLIF(o.outlet_name, ''), 'Deleted outlet') as outlet_name,
              ot.phone as outlet_phone,
              ot.address as outlet_address
       FROM public.orders o
       LEFT JOIN public.outlets ot ON o.outlet_id = ot.id
       WHERE o.id = $1`,
      [targetOrderId]
    );

    const orderRow = orderRes.rows[0];

    return NextResponse.json({
      ...result,
      order: orderRow
        ? {
            id: orderRow.id,
            status: orderRow.status,
            payment_status: orderRow.payment_status,
            pickup_code: orderRow.pickup_code,
            total: Number(orderRow.total),
            items: Array.isArray(orderRow.items) ? orderRow.items : [],
            payment_method: orderRow.payment_method || null,
            paid_at: orderRow.paid_at || orderRow.created_at || null,
            created_at: orderRow.created_at || null,
            outlet_name: orderRow.outlet_name || 'Deleted outlet',
            outlet_phone: orderRow.outlet_phone || null,
            outlet_address: orderRow.outlet_address || null,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Order verify error:', error);
    return NextResponse.json({ error: error?.message || 'Verification failed' }, { status: 500 });
  }
}
