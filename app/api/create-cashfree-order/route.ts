import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { orderId, orderAmount, customerPhone, customerName } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'payment_gateway')
      .single();

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

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': cf.app_id,
        'x-client-secret': cf.secret_key,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify({
        order_id: orderId,
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
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating Cashfree order:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create Cashfree order' },
      { status: 500 }
    );
  }
}
