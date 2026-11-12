import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';

export async function GET() {
  return new NextResponse('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

export async function POST(req: NextRequest) {
  let eventType = 'unknown';
  let cfOrderId = 'unknown';

  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-webhook-timestamp') || '';
    const signature = req.headers.get('x-webhook-signature') || '';

    // Safely parse eventType & cfOrderId early for logging
    try {
      const parsedEarly = JSON.parse(rawBody);
      eventType = parsedEarly.type || parsedEarly.event_type || 'unknown';
      cfOrderId = parsedEarly.data?.order?.order_id || 'unknown';
    } catch {}

    if (!timestamp || !signature) {
      console.log(`[Cashfree Webhook] Event: ${eventType} | Order: ${cfOrderId} | Result: bad signature`);
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
      console.log(`[Cashfree Webhook] Event: ${eventType} | Order: ${cfOrderId} | Result: bad signature`);
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.log(`[Cashfree Webhook] Event: ${eventType} | Order: ${cfOrderId} | Result: ignored`);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    eventType = payload.type || payload.event_type || 'unknown';
    const orderData = payload.data?.order;
    const paymentData = payload.data?.payment;
    cfOrderId = orderData?.order_id || 'unknown';

    if (!cfOrderId || cfOrderId === 'unknown') {
      console.log(`[Cashfree Webhook] Event: ${eventType} | Order: ${cfOrderId} | Result: ignored`);
      return NextResponse.json({ received: true, note: 'No cf_order_id found' });
    }

    // Find the order by cf_order_id or id
    const res = await query(
      `SELECT * FROM public.orders WHERE cf_order_id = $1 OR id = $2 LIMIT 1`,
      [cfOrderId, cfOrderId]
    );

    if (res.rows.length === 0) {
      console.log(`[Cashfree Webhook] Event: ${eventType} | Order: ${cfOrderId} | Result: order not found`);
      return NextResponse.json({ received: true, note: 'Order not found in DB' });
    }

    const order = res.rows[0];
    const orderId = order.id;
    const currentStatus = order.status;

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      const paidAmount = Number(paymentData?.payment_amount ?? orderData?.order_amount ?? 0);
      const expectedTotal = Number(order.total);

      // Verify that Cashfree paid amount equals order total in the database
      if (Math.abs(paidAmount - expectedTotal) > 0.01) {
        console.error(
          `Payment amount mismatch for order ${orderId}: expected ₹${expectedTotal}, received ₹${paidAmount}`
        );
        await query(
          `UPDATE public.orders SET payment_status = 'amount_mismatch', updated_at = now() WHERE id = $1`,
          [orderId]
        );
        console.log(`[Cashfree Webhook] Event: ${eventType} | Order: ${cfOrderId} | Result: processed (amount_mismatch)`);
        return NextResponse.json({
          status: 'amount_mismatch',
          orderId,
          expected: expectedTotal,
          received: paidAmount,
        });
      }

      // If status is pending_payment (or payment_cancelled/payment_failed for late success)
      let rowUpdated = false;
      let finalStatus = currentStatus;
      if (['pending_payment', 'payment_cancelled', 'payment_failed'].includes(currentStatus)) {
        const cfPaymentId = String(paymentData?.cf_payment_id || '');
        const paymentMethod =
          paymentData?.payment_group ||
          (paymentData?.payment_method?.upi ? 'upi' : null) ||
          (paymentData?.payment_method?.card ? 'card' : null) ||
          'cashfree';
        const paidAt = paymentData?.payment_time || new Date().toISOString();

        const updRes = await query(
          `UPDATE public.orders
           SET status = 'pending',
               payment_status = 'success',
               cf_payment_id = COALESCE(NULLIF($1, ''), cf_payment_id),
               payment_id = COALESCE(payment_id, NULLIF($1, '')),
               payment_method = COALESCE(payment_method, $2),
               paid_at = COALESCE(paid_at, $3),
               updated_at = now()
           WHERE id = $4
             AND status IN ('pending_payment', 'payment_cancelled', 'payment_failed')
           RETURNING status`,
          [cfPaymentId, paymentMethod, paidAt, orderId]
        );
        rowUpdated = updRes.rows.length > 0;
        if (rowUpdated) finalStatus = updRes.rows[0].status;
      }

      console.log(
        JSON.stringify({
          event: 'cashfree_webhook',
          webhook_type: eventType,
          cf_order_id: cfOrderId,
          order_id: orderId,
          cashfree_payment_status: paymentData?.payment_status || 'SUCCESS',
          row_updated: rowUpdated,
          final_status: finalStatus,
        })
      );
      return NextResponse.json({ status: 'ok', event: eventType, orderId });
    }

    if (eventType === 'PAYMENT_FAILED_WEBHOOK' || eventType === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      let rowUpdated = false;
      let finalStatus = currentStatus;
      // Only transition if status is still pending_payment
      if (currentStatus === 'pending_payment') {
        const paymentStatus = eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' ? 'dropped' : 'failed';
        const updRes = await query(
          `UPDATE public.orders
           SET status = 'payment_cancelled',
               payment_status = $1,
               updated_at = now()
           WHERE id = $2 AND status = 'pending_payment'
           RETURNING status`,
          [paymentStatus, orderId]
        );
        rowUpdated = updRes.rows.length > 0;
        if (rowUpdated) finalStatus = updRes.rows[0].status;
      }

      console.log(
        JSON.stringify({
          event: 'cashfree_webhook',
          webhook_type: eventType,
          cf_order_id: cfOrderId,
          order_id: orderId,
          cashfree_payment_status: paymentData?.payment_status || eventType,
          row_updated: rowUpdated,
          final_status: finalStatus,
        })
      );
      return NextResponse.json({ status: 'ok', event: eventType, orderId });
    }

    console.log(`[Cashfree Webhook] Event: ${eventType} | Order: ${cfOrderId} | Result: ignored`);
    return NextResponse.json({ received: true, event: eventType });
  } catch (error: any) {
    console.error('Cashfree webhook error:', error);
    return NextResponse.json({ error: error?.message || 'Webhook processing failed' }, { status: 500 });
  }
}
