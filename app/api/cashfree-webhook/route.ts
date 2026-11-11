import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-webhook-timestamp') || '';
    const signature = req.headers.get('x-webhook-signature') || '';

    if (!timestamp || !signature) {
      return NextResponse.json({ error: 'Missing webhook verification headers' }, { status: 401 });
    }

    // Load Cashfree secret key strictly from server environment variable
    const secretKey = process.env.CASHFREE_SECRET_KEY;

    if (!secretKey) {
      console.error('Missing required environment variable: CASHFREE_SECRET_KEY');
      return NextResponse.json(
        { error: 'Server configuration error: CASHFREE_SECRET_KEY is not set' },
        { status: 500 }
      );
    }

    // Verify signature: base64(HMAC_SHA256(x-webhook-timestamp + rawBody, Cashfree secret key))
    const payloadToSign = `${timestamp}${rawBody}`;
    const generatedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payloadToSign)
      .digest('base64');

    const expectedBuffer = Buffer.from(generatedSignature, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'utf-8');

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      console.warn('Invalid Cashfree webhook signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = payload.type || payload.event_type;
    const orderData = payload.data?.order;
    const paymentData = payload.data?.payment;
    const cfOrderId = orderData?.order_id;

    if (!cfOrderId) {
      // Return 200 so Cashfree does not retry unknown payload
      return NextResponse.json({ received: true, note: 'No cf_order_id found' });
    }

    // Find the order by cf_order_id or id
    const res = await query(
      `SELECT * FROM public.orders WHERE cf_order_id = $1 OR id = $2 LIMIT 1`,
      [cfOrderId, cfOrderId]
    );

    if (res.rows.length === 0) {
      // Order may belong to a test or alternate environment
      return NextResponse.json({ received: true, note: 'Order not found in DB' });
    }

    const order = res.rows[0];
    const orderId = order.id;
    const currentStatus = order.status;

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      // If status is pending_payment (or payment_cancelled/payment_failed for late success)
      if (['pending_payment', 'payment_cancelled', 'payment_failed'].includes(currentStatus)) {
        const cfPaymentId = String(paymentData?.cf_payment_id || '');
        const paymentMethod =
          paymentData?.payment_group ||
          (paymentData?.payment_method?.upi ? 'upi' : null) ||
          (paymentData?.payment_method?.card ? 'card' : null) ||
          'cashfree';
        const paidAt = paymentData?.payment_time || new Date().toISOString();

        await query(
          `UPDATE public.orders
           SET status = 'pending',
               payment_status = 'success',
               cf_payment_id = $1,
               payment_id = COALESCE(payment_id, $1),
               payment_method = $2,
               paid_at = $3,
               updated_at = now()
           WHERE id = $4`,
          [cfPaymentId, paymentMethod, paidAt, orderId]
        );
      }
      return NextResponse.json({ status: 'ok', event: eventType, orderId });
    }

    if (eventType === 'PAYMENT_FAILED_WEBHOOK' || eventType === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      // Only transition if status is still pending_payment
      if (currentStatus === 'pending_payment') {
        const paymentStatus = eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' ? 'dropped' : 'failed';
        await query(
          `UPDATE public.orders
           SET status = 'payment_cancelled',
               payment_status = $1,
               updated_at = now()
           WHERE id = $2`,
          [paymentStatus, orderId]
        );
      }
      return NextResponse.json({ status: 'ok', event: eventType, orderId });
    }

    // Return 200 for any other unhandled event
    return NextResponse.json({ received: true, event: eventType });
  } catch (error: any) {
    console.error('Cashfree webhook error:', error);
    return NextResponse.json({ error: error?.message || 'Webhook processing failed' }, { status: 500 });
  }
}
