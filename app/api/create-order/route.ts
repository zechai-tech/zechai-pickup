import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId) {
      console.error('Missing required environment variable: RAZORPAY_KEY_ID');
      return NextResponse.json(
        { error: 'Server configuration error: RAZORPAY_KEY_ID is not set' },
        { status: 500 }
      );
    }

    if (!keySecret) {
      console.error('Missing required environment variable: RAZORPAY_KEY_SECRET');
      return NextResponse.json(
        { error: 'Server configuration error: RAZORPAY_KEY_SECRET is not set' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.orderId;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: 'Valid order_id is required' },
        { status: 400 }
      );
    }

    // Load exact order total strictly from database (never trust client-sent amounts)
    const orderRes = await query(
      'SELECT id, total, status FROM public.orders WHERE id = $1 LIMIT 1',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const dbOrder = orderRes.rows[0];
    if (dbOrder.status !== 'pending_payment') {
      return NextResponse.json(
        { error: `Order is not awaiting payment (status: ${dbOrder.status})` },
        { status: 400 }
      );
    }

    const amountRupees = Math.round(Number(dbOrder.total));
    const amountPaise = amountRupees * 100;
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      return NextResponse.json(
        { error: 'Invalid order total. Minimum amount is ₹1.' },
        { status: 400 }
      );
    }

    console.log(`[Razorpay Order] orderId=${dbOrder.id} amount=${amountRupees}`);

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: body.receipt || `rcpt_${dbOrder.id.slice(0, 12)}`,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error('Razorpay create-order error:', error);
    const statusCode = error?.statusCode || (error?.error?.code === 'BAD_REQUEST_ERROR' ? 400 : 500);
    return NextResponse.json(
      { error: error?.error?.description || error?.message || 'Failed to create Razorpay order' },
      { status: statusCode }
    );
  }
}
