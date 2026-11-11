import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { orderId, dbOrderId, orderAmount, customerPhone, customerName } = await req.json();

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

    const baseUrl =
      envMode === 'production'
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
        'x-client-id': appId,
        'x-client-secret': secretKey,
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
