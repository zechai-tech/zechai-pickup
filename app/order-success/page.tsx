'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/SafeImage';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  XCircle,
  RotateCcw,
  Loader2,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { formatPrice, formatTimeIST } from '@/lib/utils';

type VerifyStatus = 'checking' | 'processing_long' | 'success' | 'failed';

interface SuccessOrderItem {
  name: string;
  price?: number;
  unitPrice?: number;
  quantity?: number;
  qty?: number;
}

interface SuccessOrderData {
  id: string;
  pickup_code: string;
  total: number;
  items: SuccessOrderItem[];
  outlet_name: string;
  outlet_address?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const clearCart = useZechaStore((state) => state.clearCart);
  const { showToast } = useToast();

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('checking');
  const [failReason, setFailReason] = useState<string>('');
  const [orderData, setOrderData] = useState<SuccessOrderData | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  // Identify order strictly from URL (no sessionStorage, localStorage, Zustand, or cookies)
  const targetOrderId = (
    searchParams.get('id') ||
    searchParams.get('order_id') ||
    ''
  ).trim();

  const verifyOrder = useCallback(
    async () => {
      if (isTerminatedRef.current) return;
      if (!targetOrderId) {
        setVerifyStatus('failed');
        setFailReason('No order identifier found.');
        isTerminatedRef.current = true;
        return;
      }

      try {
        const res = await fetch('/api/orders/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            orderId: targetOrderId,
            isReturnCheck: false,
            source: 'order_success',
          }),
        });

        const data = await res.json();
        const order = data.order;
        const status = data.status || order?.status;
        const paymentStatus = data.payment_status || order?.payment_status;

        if (
          data.paid === true ||
          paymentStatus === 'success' ||
          ['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'].includes(status)
        ) {
          isTerminatedRef.current = true;
          setVerifyStatus('success');

          const finalId = data.orderId || order?.id || targetOrderId || '';
          const finalCode = data.pickup_code || order?.pickup_code || '7309';
          const finalTotal = Number(order?.total ?? data.total ?? 0);
          const finalOutlet = order?.outlet_name || data.outlet_name || 'Deleted outlet';
          const effectivePaidAt = order?.paid_at || order?.created_at || null;

          setOrderData({
            id: finalId,
            pickup_code: finalCode,
            total: finalTotal,
            items: Array.isArray(order?.items) ? order.items : [],
            outlet_name: finalOutlet,
            outlet_address: order?.outlet_address || null,
            paid_at: effectivePaidAt,
            payment_method: order?.payment_method || 'UPI',
            created_at: order?.created_at || effectivePaidAt,
          });

          clearCart();
          try {
            sessionStorage.removeItem('zc_pending_order');
            sessionStorage.removeItem('pendingOrder');
            sessionStorage.setItem('activeOrderCode', finalCode);
            if (finalId) sessionStorage.setItem('activeOrderId', finalId);
            localStorage.removeItem('activeOrderCode');
            localStorage.removeItem('activeOrderId');
          } catch {}
          return;
        }

        if (
          ['cancelled', 'payment_cancelled', 'payment_failed'].includes(status) ||
          ['failed', 'dropped', 'cancelled', 'expired', 'abandoned'].includes(paymentStatus)
        ) {
          isTerminatedRef.current = true;
          setVerifyStatus('failed');
          setFailReason('Payment was cancelled or could not be completed.');
          try {
            sessionStorage.removeItem('zc_pending_order');
            sessionStorage.removeItem('pendingOrder');
          } catch {}
          return;
        }

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        if (elapsed >= 60) {
          isTerminatedRef.current = true;
          setVerifyStatus('processing_long');
        }
      } catch (err: any) {
        console.error('Verify error:', err);
      }
    },
    [targetOrderId, clearCart]
  );

  useEffect(() => {
    isTerminatedRef.current = false;
    startTimeRef.current = Date.now();

    verifyOrder();

    const scheduleNextPoll = () => {
      if (isTerminatedRef.current) return;
      timerRef.current = setTimeout(async () => {
        await verifyOrder();
        scheduleNextPoll();
      }, 2000);
    };

    scheduleNextPoll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [verifyOrder]);

  if (verifyStatus === 'checking') {
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

  if (verifyStatus === 'processing_long') {
    return (
      <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shadow-xs">
          <Loader2 className="w-7 h-7 animate-spin stroke-[2.5]" />
        </div>
        <h1 className="font-display text-[22px] font-extrabold text-[#2B1A12] leading-tight">
          We are still confirming.
        </h1>
        <p className="text-xs text-[#75604F] max-w-[280px]">
          Your payment might take a few moments to confirm with your bank. Please don&apos;t pay again.
        </p>
        <button
          onClick={() => {
            isTerminatedRef.current = false;
            verifyOrder();
          }}
          className="h-11 px-6 rounded-full bg-[#CE5535] text-[#FDFBEA] font-bold text-xs flex items-center gap-2 shadow-xs hover:bg-[#A8401F]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Check again</span>
        </button>
      </div>
    );
  }

  if (verifyStatus === 'failed') {
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

  const displayCode = orderData?.pickup_code || '7309';
  const digits = displayCode.padStart(4, '0').slice(-4).split('');
  const displayTotal = formatPrice(orderData?.total || 0);
  const displayOutlet = orderData?.outlet_name || 'Deleted outlet';
  const shortOrderNum = orderData?.id
    ? `#ZC-${orderData.id.replace(/-/g, '').slice(-4).toUpperCase()}`
    : '#ZC-2481';

  const baseTimestamp = orderData?.paid_at || orderData?.created_at || null;
  const paidTime = formatTimeIST(baseTimestamp) || formatTimeIST(new Date());
  const readyByTime = baseTimestamp
    ? formatTimeIST(new Date(new Date(baseTimestamp).getTime() + 15 * 60 * 1000))
    : formatTimeIST(new Date(Date.now() + 15 * 60 * 1000));

  const handleDownloadReceipt = () => {
    if (!orderData || typeof window === 'undefined') return;

    const rowsHtml = (orderData.items || [])
      .map((item) => {
        const qty = Number(item.quantity ?? item.qty ?? 1);
        const unit = Number(item.unitPrice ?? item.price ?? 0);
        return `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eadfc7;">${escapeHtml(item.name)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eadfc7;text-align:center;">${qty}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eadfc7;text-align:right;font-weight:700;">₹${Math.round(unit * qty)}</td>
        </tr>`;
      })
      .join('');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Zécha! Receipt ${escapeHtml(shortOrderNum)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background:#fdfbea; color:#2b1a12; margin:0; padding:24px; }
    .card { max-width:420px; margin:0 auto; background:#fffef7; border:1px solid #eadfc7; border-radius:20px; padding:24px; }
    .muted { color:#75604f; font-size:12px; }
    table { width:100%; border-collapse:collapse; margin:16px 0; font-size:13px; }
    th { text-align:left; font-size:11px; text-transform:uppercase; color:#75604f; padding-bottom:6px; border-bottom:1px solid #eadfc7; }
    .total { display:flex; justify-content:space-between; font-size:17px; font-weight:800; padding-top:12px; border-top:2px dashed #eadfc7; }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin:0 0 4px;font-size:22px;color:#ce5535;">Zécha!</h1>
    <div style="font-weight:700;font-size:14px;">${escapeHtml(displayOutlet)}</div>
    ${orderData.outlet_address ? `<div class="muted">${escapeHtml(orderData.outlet_address)}</div>` : ''}
    <hr style="border:none;border-top:1px solid #eadfc7;margin:14px 0;" />
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
      <span>Order: <strong>${escapeHtml(shortOrderNum)}</strong></span>
      <span>Time: <strong>${escapeHtml(paidTime)} IST</strong></span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;">
      <span>Pickup Code: <strong>${escapeHtml(displayCode)}</strong></span>
      <span>Method: <strong>${escapeHtml((orderData.payment_method || 'UPI').toUpperCase())}</strong></span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rowsHtml || `<tr><td colspan="3" style="padding:8px 0;">Pickup Order</td></tr>`}</tbody>
    </table>
    <div class="total">
      <span>Total Paid</span>
      <span>${escapeHtml(displayTotal)}</span>
    </div>
    <p class="muted" style="text-align:center;margin-top:20px;">Thank you for ordering with Zécha! One cup every day.</p>
  </div>
</body>
</html>`;

    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zecha-receipt-${shortOrderNum.replace('#', '')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Receipt downloaded', 'success');
    } catch {
      window.print();
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#FDFBEA] flex flex-col p-5 pt-4 pb-[max(28px,env(safe-area-inset-bottom))] page-transition relative select-none">
      {/* Top subtle doodle pattern background */}
      <div className="absolute top-0 left-0 right-0 h-[200px] opacity-15 pointer-events-none overflow-hidden -z-0 print:hidden">
        <SafeImage
          src="/assets/pattern.v1.webp"
          alt=""
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover"
        />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center pt-2 space-y-3.5 print:hidden">
        {/* Concentric check rings */}
        <div className="relative w-[124px] h-[124px] flex items-center justify-center shrink-0">
          <div className="w-[124px] h-[124px] rounded-full bg-[#FBEDE3] absolute inset-0 animate-in zoom-in-50 duration-300" />
          <div className="w-[96px] h-[96px] rounded-full bg-[#F4D6C8] absolute animate-in zoom-in-75 duration-350" />
          <div className="w-[72px] h-[72px] rounded-full bg-[#CE5535] text-white absolute flex items-center justify-center shadow-lg shadow-[#CE5535]/30 animate-in zoom-in-95 duration-400">
            <Check className="w-9 h-9 stroke-[3.5]" />
          </div>
        </div>

        {/* Headings */}
        <div className="text-center space-y-0.5">
          <h1 className="font-display text-[24px] font-extrabold text-[#2B1A12] tracking-tight">
            Payment successful
          </h1>
          <p className="text-[14px] text-[#75604F] font-semibold">
            {displayTotal} paid via {orderData?.payment_method || 'UPI'} · {paidTime}
          </p>
        </div>

        {/* Ticket Card */}
        <div className="w-full bg-[#FFFEF7] rounded-[24px] border border-[#EADFC7] shadow-sm relative overflow-hidden">
          <div className="p-4 px-5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#75604F] block">Order number</span>
              <span className="font-display text-[17px] font-black text-[#2B1A12]">
                {shortOrderNum}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-[#75604F] block">Ready by</span>
              <span className="font-display text-[17px] font-black text-[#2B1A12]">
                ~{readyByTime}
              </span>
            </div>
          </div>

          <div className="relative w-full flex items-center">
            <div className="w-4 h-6 bg-[#FDFBEA] rounded-r-full border-r border-t border-b border-[#EADFC7] -ml-px z-10" />
            <div className="flex-1 border-t border-dashed border-[#EADFC7]" />
            <div className="w-4 h-6 bg-[#FDFBEA] rounded-l-full border-l border-t border-b border-[#EADFC7] -mr-px z-10" />
          </div>

          <div className="p-4 pb-5 text-center space-y-2.5">
            <span className="text-[11px] font-black text-[#CE5535] tracking-widest uppercase block">
              YOUR PICKUP CODE
            </span>

            <div className="flex items-center justify-center gap-2.5">
              {digits.map((digit, i) => (
                <div
                  key={i}
                  className="w-[52px] h-[60px] rounded-[14px] bg-[#2B1A12] text-[#FDFBEA] flex items-center justify-center font-display font-extrabold text-[28px] shadow-sm"
                >
                  {digit}
                </div>
              ))}
            </div>

            <p className="text-[12px] text-[#75604F] font-medium pt-0.5">
              Show this at the counter to collect your order
            </p>
          </div>
        </div>

        {/* Sand Info Strip */}
        <div className="w-full bg-[#F4E7CC] rounded-[18px] p-3 px-4 flex items-center gap-2.5 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8B125] shrink-0" />
          <p className="text-xs font-semibold text-[#2B1A12] leading-tight">
            Sent to <span className="font-extrabold">{displayOutlet}</span>. Your order is now with
            the outlet.
          </p>
        </div>

        <p className="text-[11px] text-[#75604F] font-semibold text-center">
          Save your pickup code: <span className="font-black text-[#2B1A12]">{displayCode}</span>
        </p>
      </div>

      {/* Bottom Buttons in normal scrollable flow */}
      <div className="relative z-10 w-full space-y-2.5 pt-4 pb-3 mt-auto print:hidden">
        <Link
          href={`/track-order?id=${encodeURIComponent(orderData?.id || '')}`}
          className="w-full h-[52px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[16px] flex items-center justify-center shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-transform duration-150"
        >
          Track my order
        </Link>

        <button
          type="button"
          onClick={handleDownloadReceipt}
          className="w-full h-[48px] rounded-[20px] bg-[#FFFEF7] border-2 border-[#EADFC7] text-[#2B1A12] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#F4E7CC]/40 active:scale-[0.98] transition-transform duration-150"
        >
          <Download className="w-4 h-4" />
          <span>Download receipt</span>
        </button>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
