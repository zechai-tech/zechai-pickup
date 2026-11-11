import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

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

    const body = await req.json();
    const { amount, currency = 'INR', receipt } = body;

    // Minimum amount is 100 paise (₹1)
    if (!amount || typeof amount !== 'number' || amount < 100) {
      return NextResponse.json(
        { error: 'Invalid amount. Minimum amount is 100 paise (₹1).' },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency: currency || 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
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
