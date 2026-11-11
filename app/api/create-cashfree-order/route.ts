import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { orderId, dbOrderId, orderAmount, customerPhone, customerName } = await req.json();

    const settingsRes = await query(
      "SELECT value FROM public.app_settings WHERE key = 'payment_gateway'"
    );
    const settings = settingsRes.rows[0];
    const cf = settings?.value?.cashfree;
    if (!cf?.app_id || !cf?.secret_key) {
      return NextResponse.json({ error: 'Cashfree not configured' }, { status: 400 });
    }

    const baseUrl =
      cf.mode === 'production'
        ? 'https://api.cashfree.com/pg/orders'
        : 'https://sandbox.cashfree.com/pg/orders';

    // Format clean phone number
    const cleanPhone = (customerPhone || '').replace(/\D/g, '').slice(-10) || '9999999999';

    // Determine database order UUID and Cashfree order ID
    const resolvedDbOrderId = dbOrderId || (orderId && orderId.length === 36 ? orderId : null);
    const cfOrderId = resolvedDbOrderId
      ? `zc_${resolvedDbOrderId.replace(/-/g, '').slice(0, 16)}_${Date.now()}`
      : (orderId || `zc_${Date.now()}`);

    // Set order_expiry_time to 20 minutes from now (ISO 8601 string)
    const expiryTime = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cf.app_id,
        'x-client-secret': cf.secret_key,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify({
        order_id: cfOrderId,
        order_amount: Number(orderAmount),
        order_currency: 'INR',
        customer_details: {
          customer_id: `cust_${Date.now()}`,
          customer_phone: cleanPhone,
          customer_name: customerName || 'Customer',
        },
        order_meta: {
          return_url: `https://pickup.zechai.in/order-success?order_id={order_id}`,
        },
        order_expiry_time: expiryTime,
      }),
    });

    const data = await response.json();

    if (response.ok && data.order_id) {
      // Save cf_order_id on the order row
      if (resolvedDbOrderId) {
        await query(
          `UPDATE public.orders SET cf_order_id = $1, updated_at = now() WHERE id = $2`,
          [data.order_id, resolvedDbOrderId]
        );
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating Cashfree order:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create Cashfree order' },
      { status: 500 }
    );
  }
}
