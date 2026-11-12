'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SafeImage } from '@/components/ui/SafeImage';
import { XCircle, RotateCcw, Loader2, RefreshCw } from 'lucide-react';

type ReturnState = 'confirming' | 'timed_out' | 'failed';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_DURATION_MS = 60000;

function formatShortOrderNum(rawId: string | null): string {
  if (!rawId) return '';
  const cleaned = rawId.replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return `#ZC-${cleaned.slice(-4).toUpperCase()}`;
}

function clearPendingKey() {
  try {
    sessionStorage.removeItem('zc_pending_order');
    sessionStorage.removeItem('pendingOrder');
  } catch {}
}

function PaymentReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Identify order strictly from URL (never sessionStorage, localStorage, Zustand, or cookies)
  const urlOrderId = (searchParams.get('order_id') || searchParams.get('id') || '').trim();

  const [state, setState] = useState<ReturnState>('confirming');
  const [failReason, setFailReason] = useState<string>('');
  const [displayOrderNum, setDisplayOrderNum] = useState<string>(() =>
    formatShortOrderNum(urlOrderId)
  );
  const [isManualChecking, setIsManualChecking] = useState(false);

  const pollStartRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const terminatedRef = useRef<boolean>(false);

  const runVerification = useCallback(
    async (isInitial: boolean): Promise<'paid' | 'failed' | 'pending'> => {
      if (!urlOrderId) {
        terminatedRef.current = true;
        setFailReason('No order reference found in the return URL.');
        setState('failed');
        return 'failed';
      }

      try {
        const res = await fetch('/api/orders/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            orderId: urlOrderId,
            isReturnCheck: isInitial,
            source: 'payment_return',
          }),
        });

        const data = await res.json().catch(() => ({}));
        const resolvedId = data.orderId || data.order?.id || urlOrderId;
        if (resolvedId) {
          setDisplayOrderNum(formatShortOrderNum(resolvedId));
        }

        if (!res.ok) {
          if (res.status === 404) {
            terminatedRef.current = true;
            clearPendingKey();
            setFailReason('Order could not be found.');
            setState('failed');
            return 'failed';
          }
          return 'pending';
        }

        const status = String(data.status || data.order?.status || '').toLowerCase();
        const paymentStatus = String(
          data.payment_status || data.order?.payment_status || ''
        ).toLowerCase();

        if (
          data.paid === true ||
          paymentStatus === 'success' ||
          ['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'].includes(
            status
          )
        ) {
          terminatedRef.current = true;
          clearPendingKey();
          router.replace(`/order-success?id=${encodeURIComponent(resolvedId)}`);
          return 'paid';
        }

        if (
          ['cancelled', 'payment_cancelled', 'payment_failed'].includes(status) ||
          ['failed', 'dropped', 'cancelled', 'expired', 'abandoned'].includes(paymentStatus)
        ) {
          terminatedRef.current = true;
          clearPendingKey();
          setFailReason('Payment was cancelled or could not be completed.');
          setState('failed');
          return 'failed';
        }

        return 'pending';
      } catch (err) {
        console.error('Payment return verify error:', err);
        return 'pending';
      }
    },
    [urlOrderId, router]
  );

  useEffect(() => {
    terminatedRef.current = false;
    pollStartRef.current = Date.now();

    if (!urlOrderId) {
      setFailReason('No order reference found in the return URL.');
      setState('failed');
      return;
    }

    let cancelled = false;

    const pollLoop = async (isInitial: boolean) => {
      if (cancelled || terminatedRef.current) return;

      const outcome = await runVerification(isInitial);
      if (cancelled || terminatedRef.current || outcome !== 'pending') return;

      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= MAX_POLL_DURATION_MS) {
        setState('timed_out');
        return;
      }

      timerRef.current = setTimeout(() => {
        pollLoop(false);
      }, POLL_INTERVAL_MS);
    };

    pollLoop(true);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [urlOrderId, runVerification]);

  const handleCheckAgain = async () => {
    if (isManualChecking) return;
    setIsManualChecking(true);
    await runVerification(false);
    setIsManualChecking(false);
  };

  if (state === 'failed') {
    return (
      <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#FDF0F0] border-2 border-[#BA1A1A]/30 text-[#BA1A1A] flex items-center justify-center shadow-xs">
          <XCircle className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h1 className="font-display text-[24px] font-extrabold text-[#2B1A12]">
          Payment not completed
        </h1>
        <p className="text-xs text-[#75604F] max-w-[280px]">
          {failReason || 'Your payment was cancelled or could not be verified.'}
        </p>
        <div className="pt-2">
          <Link
            href="/cart"
            className="h-12 px-8 rounded-full bg-[#CE5535] text-[#FDFBEA] font-bold text-sm flex items-center justify-center gap-2 shadow-orange hover:bg-[#A8401F]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try again</span>
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'timed_out') {
    return (
      <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shadow-xs">
          <Loader2 className={`w-7 h-7 stroke-[2.5] ${isManualChecking ? 'animate-spin' : ''}`} />
        </div>
        <h1 className="font-display text-[22px] font-extrabold text-[#2B1A12] leading-tight">
          We&apos;re still confirming your payment
        </h1>
        {displayOrderNum && (
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#F4E7CC] text-xs font-extrabold text-[#2B1A12]">
            Order {displayOrderNum}
          </div>
        )}
        <p className="text-xs text-[#75604F] max-w-[280px]">
          Your bank or UPI app is taking a little longer to confirm. Please don&apos;t pay again.
        </p>
        <button
          type="button"
          onClick={handleCheckAgain}
          disabled={isManualChecking}
          className="h-11 px-6 rounded-full bg-[#CE5535] text-[#FDFBEA] font-bold text-xs flex items-center gap-2 shadow-xs hover:bg-[#A8401F] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isManualChecking ? 'animate-spin' : ''}`} />
          <span>{isManualChecking ? 'Checking…' : 'Check again'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition">
      <div className="relative w-36 h-12 mb-6">
        <SafeImage
          src="/assets/logo-orange.v1.webp"
          alt="Zécha!"
          width={144}
          height={48}
          sizes="144px"
          transparent
          className="object-contain w-full h-full"
        />
      </div>
      <div className="w-12 h-12 rounded-full border-3 border-[#CE5535] border-t-transparent animate-spin mb-4" />
      <h1 className="font-display text-[22px] font-extrabold text-[#2B1A12] mb-1">
        Confirming your payment…
      </h1>
      <p className="text-xs text-[#75604F]">
        Please do not close or refresh this page.
      </p>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
