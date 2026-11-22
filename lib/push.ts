import { query } from '@/lib/db';

export const PUSH_NOTIFY_ROLES = ['admin', 'super_admin', 'manager', 'staff'] as const;

export function getOneSignalAppId(): string {
  return (
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
    '77b04d4e-a7a3-47a0-8f73-88be997913a6'
  );
}

function getOneSignalRestApiKey(): string | null {
  const key = process.env.ONESIGNAL_REST_API_KEY?.trim();
  return key || null;
}

/**
 * Sends a push notification to relevant Portal staff/managers/admins when an order is paid.
 *
 * Rules:
 * - Admin / super_admin: every order from every outlet.
 * - Manager and staff of an outlet: only orders of THEIR OWN outlet (order.outlet_id).
 * - ordering_staff: not notified.
 *
 * Idempotency:
 * - Atomically claims the order with:
 *   UPDATE orders SET push_notified_at = now() WHERE id = <id> AND push_notified_at IS NULL RETURNING id;
 * - Only sends if a row was returned.
 * - If OneSignal call fails, reverts push_notified_at back to NULL so a retry can send.
 *
 * Safety:
 * - Never throws. All errors are caught and swallowed so order creation/payment is never blocked.
 * - Enforces a 3-second timeout on the external call.
 * - Never logs or exposes the REST API key.
 */
export async function sendOrderPush(orderIdOrRow: string | any): Promise<void> {
  let claimedOrderId: string | null = null;

  try {
    const rawId = typeof orderIdOrRow === 'object' && orderIdOrRow ? orderIdOrRow.id : orderIdOrRow;
    if (!rawId || typeof rawId !== 'string') {
      return;
    }

    const orderId = rawId.trim();

    // 1. Idempotency: Atomically claim the order
    const claimRes = await query(
      `UPDATE public.orders
       SET push_notified_at = now()
       WHERE id = $1 AND push_notified_at IS NULL
       RETURNING id, outlet_id, pickup_code, total, items, outlet_name`,
      [orderId]
    );

    if (claimRes.rows.length === 0) {
      // Order either does not exist, or was already claimed/push-notified
      return;
    }

    claimedOrderId = claimRes.rows[0].id;
    const order = claimRes.rows[0];
    const outletId = order.outlet_id;

    // 2. Resolve outlet name
    let outletName = order.outlet_name || '';
    if (!outletName && outletId) {
      try {
        const oRes = await query('SELECT name FROM public.outlets WHERE id = $1 LIMIT 1', [outletId]);
        if (oRes.rows.length > 0) {
          outletName = oRes.rows[0].name;
        }
      } catch (err) {
        console.warn('[OneSignal Push] Could not query outlet name:', err);
      }
    }
    if (!outletName) outletName = 'Zécha';

    // 3. Resolve recipients strictly on server
    const recipientsRes = await query(
      `SELECT id, role, outlet_id
       FROM public.users
       WHERE is_active = true
         AND role = ANY($1)
         AND (
           role IN ('admin', 'super_admin')
           OR ($2::uuid IS NOT NULL AND outlet_id = $2::uuid)
         )`,
      [PUSH_NOTIFY_ROLES as unknown as string[], outletId || null]
    );

    const recipientIds: string[] = recipientsRes.rows.map((r: any) => String(r.id));

    if (recipientIds.length === 0) {
      console.log(`[OneSignal Push] No active staff/admin recipients for order ${orderId} (outlet: ${outletName})`);
      return;
    }

    // 4. Calculate total item count
    let itemCount = 0;
    if (Array.isArray(order.items)) {
      itemCount = order.items.reduce(
        (sum: number, it: any) => sum + (Number(it.qty ?? it.quantity ?? 1) || 1),
        0
      );
    }
    if (itemCount === 0) itemCount = 1;

    const itemsText = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
    const totalText = `₹${Math.round(Number(order.total || 0))}`;
    const pickupCode = order.pickup_code || '0000';

    const apiKey = getOneSignalRestApiKey();
    if (!apiKey) {
      console.warn('[OneSignal Push] ONESIGNAL_REST_API_KEY is not configured on server. Skipping push.');
      // Revert claim so if key is configured later it can notify
      await query('UPDATE public.orders SET push_notified_at = NULL WHERE id = $1', [orderId]);
      return;
    }

    const appId = getOneSignalAppId();

    // 5. Send notification to OneSignal with 3s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const resp = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify({
          app_id: appId,
          target_channel: 'push',
          include_aliases: {
            external_id: recipientIds,
          },
          headings: { en: `New order · ${outletName}` },
          contents: { en: `#${pickupCode} · ${itemsText} · ${totalText}` },
          url: 'https://pickup.zechai.in/admin/orders',
          priority: 10,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        console.error(`[OneSignal Push] HTTP error ${resp.status} from OneSignal API:`, errorText);
        // Revert push_notified_at to NULL so a retry can succeed
        await query('UPDATE public.orders SET push_notified_at = NULL WHERE id = $1', [orderId]);
      } else {
        const data = await resp.json().catch(() => ({}));
        console.log(`[OneSignal Push] Sent notification for order #${pickupCode} (${orderId}) to ${recipientIds.length} recipient(s):`, data.id || 'ok');
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.error('[OneSignal Push] Request failed or timed out:', fetchErr?.message || fetchErr);
      // Revert claim on failure
      await query('UPDATE public.orders SET push_notified_at = NULL WHERE id = $1', [orderId]);
    }
  } catch (err: any) {
    console.error('[OneSignal Push] Unexpected error:', err?.message || err);
    if (claimedOrderId) {
      try {
        await query('UPDATE public.orders SET push_notified_at = NULL WHERE id = $1', [claimedOrderId]);
      } catch {}
    }
  }
}

/**
 * Sends a test push notification to a specific Portal user's external ID.
 */
export async function sendTestPush(
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const apiKey = getOneSignalRestApiKey();
    if (!apiKey) {
      return {
        success: false,
        message: 'ONESIGNAL_REST_API_KEY is not configured on server',
      };
    }

    const appId = getOneSignalAppId();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        include_aliases: {
          external_id: [userId],
        },
        headings: { en: 'Zécha Portal · Test Alert' },
        contents: { en: 'Push notifications are working perfectly on this device!' },
        url: 'https://pickup.zechai.in/admin/orders',
        priority: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '');
      console.error(`[OneSignal Test Push] HTTP ${resp.status}:`, errorText);
      return {
        success: false,
        message: `OneSignal error (${resp.status}): ${errorText || 'Failed to dispatch'}`,
      };
    }

    return {
      success: true,
      message: 'Test notification sent successfully',
    };
  } catch (err: any) {
    console.error('[OneSignal Test Push] Error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to send test push notification',
    };
  }
}
