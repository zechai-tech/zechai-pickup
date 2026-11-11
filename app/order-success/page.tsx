'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Check,
  XCircle,
  RotateCcw,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useZechaStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';

type VerifyStatus = 'checking' | 'processing_long' | 'success' | 'failed';

function formatTime12(dateStr?: string | Date): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const m = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${m} ${ampm}`;
}

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
    paid_at?: string;
    payment_method?: string;
    created_at?: string;
  } | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  // Target Order identifier (UUID, Cashfree order_id, or pickup code)
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
          const finalCode = data.pickup_code || order?.pickup_code || targetCode || '7309';
          const finalTotal = data.total || order?.total || 0;
          const finalOutlet = data.outlet_name || order?.outlet_name || 'Zécha! Thamarassery';

          setOrderData({
            id: finalId,
            pickup_code: finalCode,
            total: finalTotal,
            outlet_name: finalOutlet,
            paid_at: order?.paid_at || new Date().toISOString(),
            payment_method: order?.payment_method || 'UPI',
            created_at: order?.created_at,
          });

          // Clear local storage cart once order is verified
          clearCart();
          sessionStorage.removeItem('pendingOrder');
          localStorage.removeItem('activeOrderCode');
          localStorage.setItem('activeOrderCode', finalCode);
          if (finalId) localStorage.setItem('activeOrderId', finalId);
          return;
        }

        // 2. Failed / Cancelled condition
        if (
          ['cancelled', 'payment_cancelled', 'payment_failed'].includes(status) ||
          paymentStatus === 'failed' ||
          paymentStatus === 'cancelled'
        ) {
          isTerminatedRef.current = true;
          setVerifyStatus('failed');
          setFailReason('Payment was cancelled or could not be completed.');
          sessionStorage.removeItem('pendingOrder');
          return;
        }

        // 3. Still pending/unpaid
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (elapsed > 20) {
          setVerifyStatus('processing_long');
        }
      } catch (err: any) {
        console.error('Verify error:', err);
      }
    },
    [parsedSessionOrderId, targetCode, clearCart]
  );

  useEffect(() => {
    isTerminatedRef.current = false;
    startTimeRef.current = Date.now();

    verifyOrder(true);

    const scheduleNextPoll = () => {
      if (isTerminatedRef.current) return;

      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
      const delay = elapsedSeconds >= 20 ? 4000 : 2000;

      timerRef.current = setTimeout(async () => {
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
  if (verifyStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition">
        <div className="relative w-36 h-12 mb-6">
          <Image
            src="/assets/logo-orange.png"
            alt="Zécha!"
            width={144}
            height={48}
            priority
            className="object-contain"
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

  // Processing long (>20s) view
  if (verifyStatus === 'processing_long') {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shadow-xs">
          <Loader2 className="w-7 h-7 animate-spin stroke-[2.5]" />
        </div>
        <h1 className="font-display text-[22px] font-extrabold text-[#2B1A12] leading-tight">
          We are still confirming.
        </h1>
        <p className="text-xs text-[#75604F] max-w-[280px]">
          Your payment might take a few moments to confirm with your bank. Please don't pay again.
        </p>
        <button
          onClick={() => verifyOrder(false)}
          className="h-11 px-6 rounded-full bg-[#CE5535] text-[#FDFBEA] font-bold text-xs flex items-center gap-2 shadow-xs hover:bg-[#A8401F]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Check again</span>
        </button>
      </div>
    );
  }

  // Failed / Cancelled view
  if (verifyStatus === 'failed') {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition space-y-4">
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

  // SCREEN 7: Payment Successful View (Page 7 Screenshot)
  const displayCode = orderData?.pickup_code || '7309';
  const digits = displayCode.padStart(4, '0').slice(-4).split('');
  const displayTotal = orderData?.total ? formatPrice(orderData.total) : '₹291';
  const displayOutlet = orderData?.outlet_name || 'Zécha! Thamarassery';
  const shortOrderNum = orderData?.id
    ? `#ZC-${orderData.id.replace(/-/g, '').slice(-4).toUpperCase()}`
    : '#ZC-2481';

  // Ready by time (~15 min from paid)
  const readyByTime = formatTime12(
    new Date(Date.now() + 15 * 60 * 1000)
  );
  const paidTime = formatTime12(orderData?.paid_at || new Date());

  const handlePrintReceipt = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBEA] flex flex-col justify-between p-5 pb-8 page-transition relative select-none">
      {/* Top subtle doodle pattern background */}
      <div className="absolute top-0 left-0 right-0 h-[220px] opacity-15 pointer-events-none overflow-hidden -z-0">
        <Image
          src="/assets/pattern.jpg"
          alt="Pattern"
          fill
          className="object-cover"
        />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center pt-3 space-y-4">
        {/* Concentric rings: 148px outer, 116px middle, 86px center accent with white checkmark */}
        <div className="relative w-[148px] h-[148px] flex items-center justify-center shrink-0">
          {/* Outer Ring (148px) */}
          <div className="w-[148px] h-[148px] rounded-full bg-[#FBEDE3] absolute inset-0 animate-in zoom-in-50 duration-300" />
          {/* Middle Ring (116px) */}
          <div className="w-[116px] h-[116px] rounded-full bg-[#F4D6C8] absolute animate-in zoom-in-75 duration-350" />
          {/* Center Accent Circle (86px) */}
          <div className="w-[86px] h-[86px] rounded-full bg-[#CE5535] text-white absolute flex items-center justify-center shadow-lg shadow-[#CE5535]/30 animate-in zoom-in-95 duration-400">
            <Check className="w-10 h-10 stroke-[3.5]" />
          </div>
        </div>

        {/* Headings */}
        <div className="text-center space-y-0.5">
          <h1 className="font-display text-[26px] font-extrabold text-[#2B1A12] tracking-tight">
            Payment successful
          </h1>
          <p className="text-[14px] text-[#75604F] font-semibold">
            {displayTotal} paid via {orderData?.payment_method || 'UPI'} · {paidTime}
          </p>
        </div>

        {/* Ticket Card with side circular notches and dashed divider */}
        <div className="w-full bg-[#FFFEF7] rounded-[24px] border border-[#EADFC7] shadow-sm relative overflow-hidden">
          {/* Top Row: Order number & Ready by */}
          <div className="p-4 px-5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#75604F] block">
                Order number
              </span>
              <span className="font-display text-[17px] font-black text-[#2B1A12]">
                {shortOrderNum}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-[#75604F] block">
                Ready by
              </span>
              <span className="font-display text-[17px] font-black text-[#2B1A12]">
                ~{readyByTime}
              </span>
            </div>
          </div>

          {/* Dashed divider line with circular side notches */}
          <div className="relative w-full flex items-center">
            {/* Left Notch */}
            <div className="w-4 h-6 bg-[#FDFBEA] rounded-r-full border-r border-t border-b border-[#EADFC7] -ml-px z-10" />
            {/* Dashed Line */}
            <div className="flex-1 border-t border-dashed border-[#EADFC7]" />
            {/* Right Notch */}
            <div className="w-4 h-6 bg-[#FDFBEA] rounded-l-full border-l border-t border-b border-[#EADFC7] -mr-px z-10" />
          </div>

          {/* Bottom section of ticket: YOUR PICKUP CODE + 4 digit boxes */}
          <div className="p-5 text-center space-y-3">
            <span className="text-[11px] font-black text-[#CE5535] tracking-widest uppercase block">
              YOUR PICKUP CODE
            </span>

            {/* 4 dark rounded boxes (54x64px, #2B1A12) with 30px cream numerals */}
            <div className="flex items-center justify-center gap-2.5">
              {digits.map((digit, i) => (
                <div
                  key={i}
                  className="w-[54px] h-[64px] rounded-[14px] bg-[#2B1A12] text-[#FDFBEA] flex items-center justify-center font-display font-extrabold text-[30px] shadow-sm"
                >
                  {digit}
                </div>
              ))}
            </div>

            <p className="text-[12px] text-[#75604F] font-medium pt-1">
              Show this at the counter to collect your order
            </p>
          </div>
        </div>

        {/* Sand Info Strip */}
        <div className="w-full bg-[#F4E7CC] rounded-[18px] p-3 px-4 flex items-center gap-2.5 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8B125] shrink-0" />
          <p className="text-xs font-semibold text-[#2B1A12] leading-tight">
            Sent to <span className="font-extrabold">{displayOutlet}</span>. Your order is now with the outlet.
          </p>
        </div>

        {/* Screenshot reminder */}
        <p className="text-[11px] text-[#75604F] font-semibold text-center">
          Take a screenshot or save your pickup code: <span className="font-black text-[#2B1A12]">{displayCode}</span>
        </p>
      </div>

      {/* Bottom Buttons: Primary "Track my order" + Secondary "Download receipt" */}
      <div className="w-full space-y-2.5 pt-4">
        <Link
          href={`/track-order?id=${orderData?.id || ''}&code=${displayCode}`}
          className="w-full h-[56px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[16px] flex items-center justify-center shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-all"
        >
          Track my order
        </Link>

        <button
          onClick={handlePrintReceipt}
          className="w-full h-[52px] rounded-[20px] bg-transparent border-2 border-[#EADFC7] text-[#2B1A12] font-bold text-sm flex items-center justify-center hover:bg-[#FFFEF7] active:scale-[0.98] transition-all"
        >
          Download receipt
        </button>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
