import { query } from '@/lib/db';

export interface SyncResult {
  orderId: string;
  updated: boolean;
  paid: boolean;
  expired?: boolean;
  status: string;
  message?: string;
}

/**
 * Gets Cashfree gateway configuration strictly from environment variables.
 * Never reads secrets from the database.
 */
export function getCashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const mode = process.env.CASHFREE_ENV || 'production';

  if (!appId) {
    console.error('Missing required environment variable: CASHFREE_APP_ID');
    return null;
  }

  if (!secretKey) {
    console.error('Missing required environment variable: CASHFREE_SECRET_KEY');
    return null;
  }

  return {
    appId,
    secretKey,
    mode,
    baseUrl: mode === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com',
  };
}

/**
 * Verifies an order against Cashfree GET /pg/orders/{order_id}/payments.
 * Applies success updates or 20-minute auto-expiry.
 */
export async function verifyAndSyncOrder(orderIdOrRow: string | any): Promise<SyncResult> {
  try {
    let order = typeof orderIdOrRow === 'object' && orderIdOrRow ? orderIdOrRow : null;

    if (!order) {
      const res = await query('SELECT * FROM public.orders WHERE id = $1', [orderIdOrRow]);
      if (res.rows.length === 0) {
        return {
          orderId: String(orderIdOrRow),
          updated: false,
          paid: false,
          status: 'unknown',
          message: 'Order not found',
        };
      }
      order = res.rows[0];
    }

    const orderId = order.id;
    const currentStatus = order.status;

    // If order is already paid and moved past pending_payment, return as paid
    if (order.payment_status === 'success' || (currentStatus !== 'pending_payment' && currentStatus !== 'payment_cancelled' && currentStatus !== 'payment_failed')) {
      return {
        orderId,
        updated: false,
        paid: order.payment_status === 'success',
        status: currentStatus,
      };
    }

    const cfOrderId = order.cf_order_id;
    const createdAtMs = new Date(order.created_at).getTime();
    const isOlderThan20Min = Date.now() - createdAtMs > 20 * 60 * 1000;

    // If no Cashfree order id is associated
    if (!cfOrderId) {
      if (isOlderThan20Min && currentStatus === 'pending_payment') {
        await query(
          `UPDATE public.orders
           SET status = 'payment_cancelled', payment_status = 'expired', updated_at = now()
           WHERE id = $1`,
          [orderId]
        );
        return {
          orderId,
          updated: true,
          paid: false,
          expired: true,
          status: 'payment_cancelled',
        };
      }
      return {
        orderId,
        updated: false,
        paid: false,
        status: currentStatus,
      };
    }

    const cfConfig = getCashfreeConfig();
    if (!cfConfig) {
      return {
        orderId,
        updated: false,
        paid: false,
        status: currentStatus,
        message: 'Cashfree credentials not configured in environment',
      };
    }

    // Call Cashfree GET /pg/orders/{order_id}/payments
    const response = await fetch(`${cfConfig.baseUrl}/pg/orders/${encodeURIComponent(cfOrderId)}/payments`, {
      method: 'GET',
      headers: {
        'x-client-id': cfConfig.appId,
        'x-client-secret': cfConfig.secretKey,
        'x-api-version': '2023-08-01',
      },
    });

    if (!response.ok) {
      // If Cashfree returns 404 and order is older than 20 min, auto-expire
      if (response.status === 404 && isOlderThan20Min && currentStatus === 'pending_payment') {
        await query(
          `UPDATE public.orders
           SET status = 'payment_cancelled', payment_status = 'expired', updated_at = now()
           WHERE id = $1`,
          [orderId]
        );
        return {
          orderId,
          updated: true,
          paid: false,
          expired: true,
          status: 'payment_cancelled',
        };
      }

      return {
        orderId,
        updated: false,
        paid: false,
        status: currentStatus,
        message: `Cashfree check returned status ${response.status}`,
      };
    }

    const payments = await response.json();
    const paymentsList = Array.isArray(payments) ? payments : [];

    const successfulPayment = paymentsList.find(
      (p: any) => p.payment_status === 'SUCCESS' || p.payment_status === 'PAID'
    );

    if (successfulPayment) {
      const paymentMethod =
        successfulPayment.payment_group ||
        (successfulPayment.payment_method?.upi ? 'upi' : null) ||
        (successfulPayment.payment_method?.card ? 'card' : null) ||
        'cashfree';
      const cfPaymentId = String(successfulPayment.cf_payment_id || '');
      const paidAt = successfulPayment.payment_time || new Date().toISOString();

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

      return {
        orderId,
        updated: true,
        paid: true,
        expired: false,
        status: 'pending',
      };
    }

    // Not paid
    if (isOlderThan20Min && currentStatus === 'pending_payment') {
      await query(
        `UPDATE public.orders
         SET status = 'payment_cancelled', payment_status = 'expired', updated_at = now()
         WHERE id = $1`,
        [orderId]
      );
      return {
        orderId,
        updated: true,
        paid: false,
        expired: true,
        status: 'payment_cancelled',
      };
    }

    return {
      orderId,
      updated: false,
      paid: false,
      expired: false,
      status: currentStatus,
    };
  } catch (err: any) {
    console.error(`Error verifying order ${orderIdOrRow}:`, err);
    return {
      orderId: typeof orderIdOrRow === 'object' ? orderIdOrRow?.id : String(orderIdOrRow),
      updated: false,
      paid: false,
      status: 'error',
      message: err?.message,
    };
  }
}
