import { NextRequest, NextResponse } from 'next/server';
import { verifyAndSyncOrder } from '@/lib/order-sync';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { orderId, pickupCode } = await req.json();

    if (!orderId && !pickupCode) {
      return NextResponse.json({ error: 'Order ID or pickup code is required' }, { status: 400 });
    }

    let targetOrderId = orderId;
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

    const result = await verifyAndSyncOrder(targetOrderId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Order verify error:', error);
    return NextResponse.json({ error: error?.message || 'Verification failed' }, { status: 500 });
  }
}
