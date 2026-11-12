import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateAnalyticsRequest } from '@/lib/analytics-server';
import { maskPhoneNumber } from '@/lib/analytics-utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAnalyticsRequest(req, { requireDates: false });
    if (!auth.ok) return auth.response;

    const { ctx } = auth;
    const { searchParams } = new URL(req.url);
    const id = (searchParams.get('id') || '').trim();

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Valid order id UUID is required' }, { status: 400 });
    }

    const res = await query(
      `SELECT o.id, o.pickup_code, o.outlet_id,
              COALESCE(ot.name, NULLIF(o.outlet_name, ''), 'Deleted outlet') AS outlet_name,
              o.customer_name, o.customer_phone, o.items, o.total, o.status,
              o.payment_status, o.payment_method, o.kitchen_note,
              o.created_at, o.paid_at, o.making_at, o.packaging_at, o.ready_at, o.received_at
       FROM public.orders o
       LEFT JOIN public.outlets ot ON o.outlet_id = ot.id
       WHERE o.id = $1::uuid
       LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = res.rows[0];
    if (ctx.isManager && order.outlet_id !== ctx.userOutletId) {
      return NextResponse.json(
        { error: 'Forbidden: order belongs to another outlet' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      order: {
        ...order,
        customer_phone: ctx.isAdmin
          ? order.customer_phone
          : maskPhoneNumber(order.customer_phone),
      },
    });
  } catch (err: any) {
    console.error('Analytics order detail route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load order details' },
      { status: 500 }
    );
  }
}
