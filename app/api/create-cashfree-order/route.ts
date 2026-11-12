import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.orderId;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Valid order_id is required' }, { status: 400 });
    }

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const envMode = process.env.CASHFREE_ENV || 'production';

    if (!appId) {
      console.error('Missing required environment variable: CASHFREE_APP_ID');
      return NextResponse.json(
        { error: 'Payment gateway configuration error: CASHFREE_APP_ID is not set' },
        { status: 500 }
      );
    }

    if (!secretKey) {
      console.error('Missing required environment variable: CASHFREE_SECRET_KEY');
      return NextResponse.json(
        { error: 'Payment gateway configuration error: CASHFREE_SECRET_KEY is not set' },
        { status: 500 }
      );
    }

    // Load order and verified total strictly from the database
    const orderRes = await query(
      'SELECT id, total, customer_phone, customer_name, status FROM public.orders WHERE id = $1 LIMIT 1',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    if (order.status !== 'pending_payment') {
      return NextResponse.json(
        { error: `Order is not in pending_payment status (current: ${order.status})` },
        { status: 400 }
      );
    }

    const baseUrl =
      envMode === 'production'
        ? 'https://api.cashfree.com/pg/orders'
        : 'https://sandbox.cashfree.com/pg/orders';

    // Format clean phone number from database record
    const cleanPhone = (order.customer_phone || '').replace(/\D/g, '').slice(-10) || '9999999999';

    // Cashfree order ID format
    const cfOrderId = `zc_${order.id.replace(/-/g, '').slice(0, 16)}_${Date.now()}`;

    // Set order_expiry_time to 20 minutes from now (ISO 8601 string)
    const expiryTime = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const gatewayAmount = Math.round(Number(order.total));
    console.log(`[Cashfree Order] orderId=${order.id} order_amount=${gatewayAmount}`);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify({
        order_id: cfOrderId,
        order_amount: gatewayAmount,
        order_currency: 'INR',
        customer_details: {
          customer_id: `cust_${order.id.replace(/-/g, '').slice(0, 12)}`,
          customer_phone: cleanPhone,
          customer_name: order.customer_name || 'Customer',
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
      await query(
        `UPDATE public.orders SET cf_order_id = $1, updated_at = now() WHERE id = $2`,
        [data.order_id, order.id]
      );
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
