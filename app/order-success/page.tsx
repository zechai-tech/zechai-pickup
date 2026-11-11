'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Check,
  ArrowRight,
  Store,
  Clock,
  XCircle,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useZechaStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';

type VerifyStatus = 'checking' | 'processing_long' | 'success' | 'failed';

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearCart = useZechaStore((state) => state.clearCart);

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('checking');
  const [failReason, setFailReason] = useState<string>('');
  const [orderData, setOrderData] = useState<{
    id: string;
    pickup_code: string;
    total: number;
    outlet_name: string;
  } | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  // Target Order identifier (UUID, Cashfree order_id, or code)
  const targetOrderId =
    searchParams.get('id') ||
    searchParams.get('order_id') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('pendingOrder') : null);

  const parsedSessionOrderId = React.useMemo(() => {
    if (!targetOrderId) return null;
    try {
      if (targetOrderId.startsWith('{')) {
        const parsed = JSON.parse(targetOrderId);
        return parsed.orderId || null;
      }
    } catch {}
    return targetOrderId;
  }, [targetOrderId]);

  const targetCode = searchParams.get('code');

  const verifyOrder = useCallback(
    async (isReturn = true) => {
      if (isTerminatedRef.current) return;
      if (!parsedSessionOrderId && !targetCode) {
        setVerifyStatus('failed');
        setFailReason('No order identifier found.');
        isTerminatedRef.current = true;
        return;
      }

      try {
        const res = await fetch('/api/orders/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: parsedSessionOrderId,
            pickupCode: targetCode,
            isReturnCheck: isReturn,
          }),
        });

        const data = await res.json();
        const order = data.order;
        const status = data.status || order?.status;
        const paymentStatus = data.payment_status || order?.payment_status;

        // 1. Success condition
        if (
          data.paid === true ||
          paymentStatus === 'success' ||
          ['pending', 'preparing', 'packaging', 'ready', 'received'].includes(status)
        ) {
          isTerminatedRef.current = true;
          setVerifyStatus('success');

          const finalId = data.orderId || order?.id || parsedSessionOrderId || '';
          const finalCode = data.pickup_code || order?.pickup_code || targetCode || '----';
          const finalTotal = data.total || order?.total || 0;
          const finalOutlet = data.outlet_name || order?.outlet_name || 'Zécha! Outlet';

          setOrderData({
            id: finalId,
            pickup_code: finalCode,
            total: finalTotal,
            outlet_name: finalOutlet,
          });

          // Safely clear cart only upon verified payment success
          clearCart();
          sessionStorage.removeItem('pendingOrder');

          // Store active order info for the banner
          if (finalId) localStorage.setItem('activeOrderId', finalId);
          if (finalCode) localStorage.setItem('activeOrderCode', finalCode);
          localStorage.setItem('activeOrderTime', Date.now().toString());
          localStorage.setItem('activeOrderOutlet', finalOutlet);

          return;
        }

        // 2. Failed / Cancelled / Dropped / Expired / Abandoned
        if (status === 'payment_cancelled' || status === 'payment_failed') {
          isTerminatedRef.current = true;
          setVerifyStatus('failed');

          if (paymentStatus === 'dropped') {
            setFailReason('Payment was cancelled or closed before completion.');
          } else if (paymentStatus === 'failed') {
            setFailReason('Payment could not be completed by your bank or gateway.');
          } else if (paymentStatus === 'expired') {
            setFailReason('Payment session has expired.');
          } else if (paymentStatus === 'abandoned') {
            setFailReason('Checkout was not completed.');
          } else if (status === 'amount_mismatch') {
            setFailReason('Payment amount discrepancy detected.');
          } else {
            setFailReason('Payment was not completed.');
          }
          return;
        }

        // 3. Still Pending
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        if (elapsedSeconds >= 90) {
          setVerifyStatus('processing_long');
        }
      } catch (e) {
        console.warn('Verify poll error:', e);
      }
    },
    [parsedSessionOrderId, targetCode, clearCart]
  );

  useEffect(() => {
    isTerminatedRef.current = false;
    startTimeRef.current = Date.now();

    // Immediate first check with isReturnCheck = true
    verifyOrder(true);

    const scheduleNextPoll = () => {
      if (isTerminatedRef.current) return;

      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      // After 90 seconds, slow down polling to 10s
      const delay = elapsedSeconds >= 90 ? 10000 : 2000;

      timerRef.current = setTimeout(async () => {
        // Subsequent checks pass false for isReturnCheck so they don't immediately abandon pending payments
        await verifyOrder(false);
        scheduleNextPoll();
      }, delay);
    };

    scheduleNextPoll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [verifyOrder]);

  // Loading / Checking view
  if (verifyStatus === 'checking' || verifyStatus === 'processing_long') {
    return (
      <div className="min-h-[100dvh] h-full flex flex-col justify-between bg-[#FDFBEA] p-4 pb-8 page-transition overflow-y-auto overflow-x-hidden scrollbar-none w-full max-w-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto w-full max-w-[320px] mx-auto py-3 px-1 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#FBEDE3] border-2 border-[#CE5535]/30 text-[#CE5535] flex items-center justify-center mb-2 shadow-xs animate-in zoom-in-75 duration-300">
            <Loader2 className="w-8 h-8 animate-spin stroke-[2.5]" />
          </div>

          <h1 className="font-display font-black text-2xl text-[#2B1A12] tracking-tight leading-tight">
            Checking your payment...
          </h1>

          <p className="text-xs text-[#75604F] font-medium leading-relaxed">
            {verifyStatus === 'processing_long'
              ? 'Payment is still processing. This page will update by itself.'
              : 'Verifying with payment gateway. Please do not close or refresh this page.'}
          </p>

          <div className="w-full bg-[#FFFEF7] border border-[#EADFC7] rounded-2xl p-4 text-xs text-[#75604F] text-left space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-[#2B1A12]">
              <Clock className="w-3.5 h-3.5 text-[#CE5535]" />
              <span>Secure Verification in progress</span>
            </div>
            <p className="text-[11px] text-[#75604F]/80">
              We confirm your payment with the server before sending your ticket to the kitchen.
            </p>
          </div>
        </div>

        <div className="shrink-0 w-full max-w-[320px] mx-auto text-center safe-bottom">
          <span className="text-[11px] text-[#75604F]/60 font-semibold">Zécha! Express Pickup</span>
        </div>
      </div>
    );
  }

  // Payment Failed / Not completed view
  if (verifyStatus === 'failed') {
    return (
      <div className="min-h-[100dvh] h-full flex flex-col justify-between bg-[#FDFBEA] p-4 pb-8 page-transition overflow-y-auto overflow-x-hidden scrollbar-none w-full max-w-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto w-full max-w-[320px] mx-auto py-3 px-1">
          <div className="w-16 h-16 rounded-full bg-[#FDF0F0] border-2 border-[#BA1A1A]/30 text-[#BA1A1A] flex items-center justify-center mb-4 shadow-xs animate-in zoom-in-75 duration-300">
            <XCircle className="w-9 h-9 stroke-[2.2]" />
          </div>

          <h1 className="font-display font-black text-2xl text-[#2B1A12] tracking-tight mb-1.5 leading-tight">
            Payment Not Completed
          </h1>
          <p className="text-xs text-[#75604F] font-medium mb-6">
            {failReason || 'Your payment was not completed or has expired.'}
          </p>

          <div className="w-full bg-[#FFFEF7] border border-[#EADFC7] rounded-3xl p-5 shadow-xs mb-6 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#BA1A1A]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No money was deducted</span>
            </div>
            <p className="text-[11px] text-[#75604F] leading-relaxed">
              If an amount was debited from your bank account or UPI app, it will be automatically
              refunded by your bank or updated once confirmed.
            </p>
          </div>
        </div>

        <div className="shrink-0 w-full max-w-[320px] mx-auto space-y-2.5 pt-1 safe-bottom px-1">
          {/* Try again button (Primary orange) */}
          <Link href="/cart" className="block w-full">
            <Button className="w-full h-12 text-base font-bold bg-[#CE5535] hover:bg-[#A8401F] text-white shadow-orange group rounded-2xl flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Try again</span>
            </Button>
          </Link>

          <div className="text-center">
            <Link
              href="/outlet"
              className="text-xs sm:text-sm font-bold text-[#75604F] hover:text-[#CE5535] transition-colors py-1.5 inline-block"
            >
              ← Back to menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Payment Success view
  const displayCode = orderData?.pickup_code || '----';
  const displayOutlet = orderData?.outlet_name || 'Zécha! Outlet';
  const displayTotal = orderData?.total ? formatPrice(orderData.total) : '';

  return (
    <div className="min-h-[100dvh] h-full flex flex-col justify-between bg-[#FDFBEA] p-4 pb-8 page-transition overflow-y-auto overflow-x-hidden scrollbar-none w-full max-w-full">
      {/* Top Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-auto w-full max-w-[320px] mx-auto py-3 px-1">
        {/* 1. Big green checkmark circle */}
        <div className="w-16 h-16 rounded-full bg-[#2F7A3E] text-white flex items-center justify-center mb-4 shadow-lg animate-in zoom-in-75 duration-300">
          <Check className="w-8 h-8 stroke-[3.5]" />
        </div>

        {/* 2. Heading */}
        <h1 className="font-display font-black text-2xl text-[#2B1A12] tracking-tight mb-1.5 leading-tight">
          Payment Successful!
        </h1>
        <p className="text-xs text-[#75604F] font-medium mb-4">
          Your order has been sent to the kitchen
        </p>

        {/* 3. Big Styled Box for Pickup Code */}
        <div className="w-full bg-[#FBEDE3] border-2 border-dashed border-[#CE5535] rounded-3xl p-5 shadow-sm mb-4 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#75604F] block mb-1">
            Your pickup code
          </span>
          <div className="font-display font-black text-5xl text-[#CE5535] tracking-widest my-1 select-all">
            {displayCode}
          </div>
        </div>

        {/* 4. Details below code */}
        <div className="space-y-1 mb-5 text-center w-full">
          <p className="text-xs font-semibold text-[#75604F]">
            Show this code at the counter
          </p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#2B1A12] font-bold truncate max-w-full">
            <Store className="w-3.5 h-3.5 text-[#CE5535] shrink-0" />
            <span className="truncate">{displayOutlet}</span>
          </div>
          {displayTotal && (
            <p className="text-sm font-extrabold text-[#2B1A12]">
              Total paid: {displayTotal}
            </p>
          )}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#75604F]/80 pt-0.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-[#75604F]/60" />
            <span>Estimated pickup: 15-20 min</span>
          </div>
        </div>
      </div>

      {/* 5 & 6: Action Buttons */}
      <div className="shrink-0 w-full max-w-[320px] mx-auto space-y-2.5 pt-1 safe-bottom px-1">
        {/* Track my order button (Primary orange) */}
        <Link
          href={
            orderData?.id
              ? `/track-order?id=${encodeURIComponent(orderData.id)}`
              : `/track-order?code=${displayCode}`
          }
          className="block w-full"
        >
          <Button className="w-full h-12 text-base font-bold bg-[#CE5535] hover:bg-[#A8401F] text-white shadow-orange group rounded-2xl">
            <span>Track my order</span>
            <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>

        {/* Back to menu text button */}
        <div className="text-center">
          <Link
            href="/outlet"
            className="text-xs sm:text-sm font-bold text-[#75604F] hover:text-[#CE5535] transition-colors py-1.5 inline-block"
          >
            ← Back to menu
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#FDFBEA] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CE5535]" />
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
