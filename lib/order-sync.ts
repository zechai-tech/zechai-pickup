import { query } from '@/lib/db';

export interface SyncResult {
  orderId: string;
  updated: boolean;
  paid: boolean;
  pending?: boolean;
  expired?: boolean;
  status: string;
  payment_status?: string;
  message?: string;
}

export interface VerifyOptions {
  isReturnCheck?: boolean;
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
 * Verifies an order against Cashfree GET /pg/orders/{order_id} and GET /pg/orders/{order_id}/payments.
 * Applies success updates, pending state, failed/dropped/abandoned transitions, or 20-minute auto-expiry.
 */
export async function verifyAndSyncOrder(
  orderIdOrRow: string | any,
  options?: VerifyOptions
): Promise<SyncResult> {
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
    if (
      order.payment_status === 'success' ||
      (currentStatus !== 'pending_payment' &&
        currentStatus !== 'payment_cancelled' &&
        currentStatus !== 'payment_failed')
    ) {
      return {
        orderId,
        updated: false,
        paid: order.payment_status === 'success' || currentStatus !== 'pending_payment',
        status: currentStatus,
        payment_status: order.payment_status || 'success',
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
          payment_status: 'expired',
        };
      }
      return {
        orderId,
        updated: false,
        paid: false,
        status: currentStatus,
        payment_status: order.payment_status || 'unpaid',
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

    // Call Cashfree in parallel: GET /pg/orders/{order_id} AND GET /pg/orders/{order_id}/payments
    const [orderRes, paymentsRes] = await Promise.all([
      fetch(`${cfConfig.baseUrl}/pg/orders/${encodeURIComponent(cfOrderId)}`, {
        method: 'GET',
        headers: {
          'x-client-id': cfConfig.appId,
          'x-client-secret': cfConfig.secretKey,
          'x-api-version': '2023-08-01',
        },
      }).catch((e) => {
        console.warn('Cashfree order fetch error:', e);
        return null;
      }),
      fetch(`${cfConfig.baseUrl}/pg/orders/${encodeURIComponent(cfOrderId)}/payments`, {
        method: 'GET',
        headers: {
          'x-client-id': cfConfig.appId,
          'x-client-secret': cfConfig.secretKey,
          'x-api-version': '2023-08-01',
        },
      }).catch((e) => {
        console.warn('Cashfree payments fetch error:', e);
        return null;
      }),
    ]);

    let cfOrder: any = null;
    if (orderRes && orderRes.ok) {
      try {
        cfOrder = await orderRes.json();
      } catch (e) {
        console.warn('Error parsing cfOrder JSON:', e);
      }
    }

    let paymentsList: any[] = [];
    if (paymentsRes && paymentsRes.ok) {
      try {
        const paymentsData = await paymentsRes.json();
        paymentsList = Array.isArray(paymentsData) ? paymentsData : [];
      } catch (e) {
        console.warn('Error parsing paymentsData JSON:', e);
      }
    }

    // 1. Check for SUCCESS / PAID payment
    const successfulPayment = paymentsList.find(
      (p: any) => p.payment_status === 'SUCCESS' || p.payment_status === 'PAID'
    );

    if (successfulPayment) {
      const paidAmount = Number(successfulPayment.payment_amount || 0);
      const expectedTotal = Number(order.total);

      // Verify payment amount matches order total
      if (Math.abs(paidAmount - expectedTotal) > 0.01) {
        console.error(
          `Payment amount mismatch for order ${orderId}: expected ₹${expectedTotal}, received ₹${paidAmount}`
        );
        await query(
          `UPDATE public.orders SET payment_status = 'amount_mismatch', updated_at = now() WHERE id = $1`,
          [orderId]
        );
        return {
          orderId,
          updated: true,
          paid: false,
          status: 'amount_mismatch',
          payment_status: 'amount_mismatch',
          message: 'Payment amount mismatch',
        };
      }

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
        payment_status: 'success',
      };
    }

    // 2. Check for PENDING payment (e.g. UPI request waiting)
    const hasPendingPayment = paymentsList.some((p: any) => p.payment_status === 'PENDING');
    if (hasPendingPayment) {
      // Never expire or cancel an order that has a payment currently PENDING
      return {
        orderId,
        updated: false,
        paid: false,
        pending: true,
        status: currentStatus,
        payment_status: 'pending',
      };
    }

    // 3. Payments exist and latest is FAILED, USER_DROPPED or CANCELLED (none is PENDING)
    if (paymentsList.length > 0) {
      const sortedPayments = [...paymentsList].sort((a: any, b: any) => {
        const tA = new Date(a.payment_time || 0).getTime();
        const tB = new Date(b.payment_time || 0).getTime();
        return tA - tB;
      });
      const latestPayment = sortedPayments[sortedPayments.length - 1];
      const rawStatus = String(latestPayment?.payment_status || '');
      const paymentStatus =
        rawStatus === 'USER_DROPPED' ? 'dropped' : rawStatus === 'FAILED' ? 'failed' : 'failed';

      if (currentStatus === 'pending_payment') {
        await query(
          `UPDATE public.orders
           SET status = 'payment_cancelled', payment_status = $1, updated_at = now()
           WHERE id = $2`,
          [paymentStatus, orderId]
        );
      }

      return {
        orderId,
        updated: true,
        paid: false,
        status: 'payment_cancelled',
        payment_status: paymentStatus,
      };
    }

    // 4. Cashfree order_status is EXPIRED or TERMINATED
    if (cfOrder?.order_status === 'EXPIRED' || cfOrder?.order_status === 'TERMINATED') {
      if (currentStatus === 'pending_payment') {
        await query(
          `UPDATE public.orders
           SET status = 'payment_cancelled', payment_status = 'expired', updated_at = now()
           WHERE id = $1`,
          [orderId]
        );
      }
      return {
        orderId,
        updated: true,
        paid: false,
        expired: true,
        status: 'payment_cancelled',
        payment_status: 'expired',
      };
    }

    // 5. Customer returned to return URL and Cashfree shows no attempts and order is ACTIVE
    if (options?.isReturnCheck && paymentsList.length === 0 && (cfOrder?.order_status === 'ACTIVE' || !cfOrder)) {
      if (currentStatus === 'pending_payment') {
        await query(
          `UPDATE public.orders
           SET status = 'payment_cancelled', payment_status = 'abandoned', updated_at = now()
           WHERE id = $1`,
          [orderId]
        );
      }
      return {
        orderId,
        updated: true,
        paid: false,
        status: 'payment_cancelled',
        payment_status: 'abandoned',
      };
    }

    // 6. 20-minute auto-expiry for background cleanup
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
        payment_status: 'expired',
      };
    }

    return {
      orderId,
      updated: false,
      paid: false,
      status: currentStatus,
      payment_status: order.payment_status || 'unpaid',
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
