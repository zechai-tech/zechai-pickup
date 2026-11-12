'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export const PENDING_ORDER_STORAGE_KEY = 'zc_pending_order';

const WATCHED_PATHS = new Set(['/', '/outlets', '/menu', '/cart', '/track-order']);

export function PendingOrderSafetyNet() {
  const pathname = usePathname();
  const router = useRouter();
  const inFlightRef = useRef(false);

  const checkPendingOrder = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!pathname || !WATCHED_PATHS.has(pathname)) return;
    if (inFlightRef.current) return;

    let pendingOrderId: string | null = null;
    try {
      pendingOrderId = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    } catch {
      return;
    }

    if (!pendingOrderId || !pendingOrderId.trim()) return;

    inFlightRef.current = true;
    try {
      const res = await fetch('/api/orders/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          orderId: pendingOrderId.trim(),
          isReturnCheck: false,
          source: 'safety_net',
        }),
      });

      if (res.status === 404) {
        try {
          sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        } catch {}
        return;
      }

      if (!res.ok) return;

      const data = await res.json().catch(() => ({}));
      const status = String(data.status || data.order?.status || '').toLowerCase();
      const paymentStatus = String(
        data.payment_status || data.order?.payment_status || ''
      ).toLowerCase();
      const finalId = data.orderId || data.order?.id || pendingOrderId.trim();

      if (
        data.paid === true ||
        paymentStatus === 'success' ||
        ['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'].includes(
          status
        )
      ) {
        try {
          sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        } catch {}
        router.replace(`/order-success?id=${encodeURIComponent(finalId)}`);
        return;
      }

      if (
        ['cancelled', 'payment_cancelled', 'payment_failed'].includes(status) ||
        ['failed', 'dropped', 'cancelled', 'expired', 'abandoned'].includes(paymentStatus)
      ) {
        try {
          sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        } catch {}
      }
      // If still pending_payment, do nothing (do not nag).
    } catch {
      // Silent retry on next focus/navigation
    } finally {
      inFlightRef.current = false;
    }
  }, [pathname, router]);

  useEffect(() => {
    checkPendingOrder();

    const handleVisibility = () => {
      if (!document.hidden) {
        checkPendingOrder();
      }
    };
    const handleFocus = () => {
      checkPendingOrder();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkPendingOrder]);

  return null;
}
