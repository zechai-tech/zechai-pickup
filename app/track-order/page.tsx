'use client';

import React, { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Phone,
  Check,
  MapPin,
  QrCode,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useZechaStore } from '@/lib/store';
import { normalizeOrderStatus } from '@/lib/order-flow';
import { formatPrice, formatTimeIST } from '@/lib/utils';

interface OrderItem {
  id?: string;
  name: string;
  price?: number;
  unitPrice?: number;
  quantity?: number;
  qty?: number;
}

interface OrderData {
  id: string;
  pickup_code: string;
  status: string;
  cancel_reason?: string | null;
  total: number;
  items: OrderItem[];
  created_at?: string;
  paid_at?: string | null;
  making_at?: string | null;
  packaging_at?: string | null;
  ready_at?: string | null;
  received_at?: string | null;
  outlet_name?: string;
  outlet_phone?: string | null;
  outlet_address?: string | null;
}

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetAll = useZechaStore((s) => s.resetAll);
  const urlId = searchParams.get('id');
  const urlCode = searchParams.get('code');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);

  // Track whether this page visit observed an active stage BEFORE transitioning live to 'received'
  const sawPrePickupDuringSessionRef = useRef(false);
  const pickedUpSequenceStartedRef = useRef(false);
  const isRedirectingHomeRef = useRef(false);

  const clearCustomerOrderState = useCallback(() => {
    resetAll();
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('activeOrderId');
        sessionStorage.removeItem('activeOrderCode');
        sessionStorage.removeItem('activeOrderTime');
        sessionStorage.removeItem('pendingOrder');
        localStorage.removeItem('zecha_store_storage');
        localStorage.removeItem('activeOrderId');
        localStorage.removeItem('activeOrderCode');
        localStorage.removeItem('activeOrderTime');
      } catch {}
    }
  }, [resetAll]);

  const handleBackToHome = useCallback(() => {
    clearCustomerOrderState();
    router.replace('/');
  }, [clearCustomerOrderState, router]);

  const fetchOrder = useCallback(
    async (isSilent = false) => {
      const targetId =
        urlId || (typeof window !== 'undefined' ? sessionStorage.getItem('activeOrderId') : null);
      const targetCode =
        urlCode ||
        (!targetId && typeof window !== 'undefined' ? sessionStorage.getItem('activeOrderCode') : null);

      if (!targetId && !targetCode) {
        if (!isSilent) {
          setError('No order identifier provided');
          setLoading(false);
        }
        return;
      }

      try {
        const param = targetId
          ? `id=${encodeURIComponent(targetId)}`
          : `code=${encodeURIComponent(targetCode!)}`;

        const res = await fetch(`/api/orders/track?${param}`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok || !data.order) {
          if (!isSilent) setError(data.error || 'Order not found');
        } else {
          const nextOrder: OrderData = data.order;
          const canon = normalizeOrderStatus(nextOrder.status);
          if (['pending', 'preparing', 'packaging', 'ready'].includes(canon)) {
            sawPrePickupDuringSessionRef.current = true;
          }

          setOrder(nextOrder);
          setError(null);
          if (!isRedirectingHomeRef.current && ['pending', 'preparing', 'packaging', 'ready'].includes(canon)) {
            if (nextOrder.id) {
              sessionStorage.setItem('activeOrderId', nextOrder.id);
            }
            if (nextOrder.pickup_code) {
              sessionStorage.setItem('activeOrderCode', nextOrder.pickup_code);
            }
          } else if (canon === 'received' || canon === 'cancelled' || canon === 'payment_cancelled') {
            sessionStorage.removeItem('activeOrderId');
            sessionStorage.removeItem('activeOrderCode');
            sessionStorage.removeItem('activeOrderTime');
            sessionStorage.removeItem('pendingOrder');
          }
        }
      } catch (e: any) {
        if (!isSilent) setError(e.message || 'Error fetching order');
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [urlId, urlCode]
  );

  // Initial load + 5s polling fallback + focus/visibility refetch
  useEffect(() => {
    fetchOrder(false);

    const intervalId = setInterval(() => {
      fetchOrder(true);
    }, 5000);

    const handleFocus = () => fetchOrder(true);
    const handleVisibility = () => {
      if (!document.hidden) fetchOrder(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchOrder]);

  // Supabase Realtime subscription on this specific order for instant UI ticks without refresh
  useEffect(() => {
    if (!order?.id) return;

    const channel = supabase
      .channel(`customer-track-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        () => {
          fetchOrder(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id, fetchOrder]);

  // Handle live transition to 'received' (Picked up -> 1.5s ticked -> Thank you screen -> 5s auto redirect)
  const canonStatus = order ? normalizeOrderStatus(order.status) : null;
  useEffect(() => {
    if (
      canonStatus === 'received' &&
      sawPrePickupDuringSessionRef.current &&
      !pickedUpSequenceStartedRef.current
    ) {
      pickedUpSequenceStartedRef.current = true;

      const showThankYouTimer = setTimeout(() => {
        setShowThankYou(true);
      }, 1500);

      return () => {
        clearTimeout(showThankYouTimer);
      };
    }
  }, [canonStatus]);

  useEffect(() => {
    if (!showThankYou) return;
    isRedirectingHomeRef.current = true;
    clearCustomerOrderState();

    const redirectTimer = setTimeout(() => {
      clearCustomerOrderState();
      router.replace('/');
    }, 5000);

    return () => clearTimeout(redirectTimer);
  }, [showThankYou, clearCustomerOrderState, router]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#FDF0F0] text-[#BA1A1A] flex items-center justify-center">
          <XCircle className="w-8 h-8" />
        </div>
        <h2 className="font-display text-xl font-bold text-[#2B1A12]">
          {error || 'Order not found'}
        </h2>
        <Link
          href="/"
          className="h-11 px-6 rounded-full bg-[#CE5535] text-[#FDFBEA] font-bold text-xs flex items-center shadow-xs"
        >
          Back to home
        </Link>
      </div>
    );
  }

  // Full-screen "Thank you for ordering" screen after Picked up
  if (showThankYou) {
    return (
      <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-between p-6 py-10 text-center page-transition select-none">
        <div className="relative w-32 h-11">
          <SafeImage
            src="/assets/logo-orange.v1.webp"
            alt="Zécha!"
            width={128}
            height={44}
            sizes="128px"
            transparent
            className="object-contain w-full h-full"
          />
        </div>

        <div className="flex flex-col items-center space-y-5 my-auto">
          <div className="relative w-[132px] h-[132px] flex items-center justify-center">
            <div className="w-[132px] h-[132px] rounded-full bg-[#FBEDE3] absolute inset-0 animate-in zoom-in-50 duration-300" />
            <div className="w-[102px] h-[102px] rounded-full bg-[#F4D6C8] absolute animate-in zoom-in-75 duration-350" />
            <div className="w-[74px] h-[74px] rounded-full bg-[#2F7A3E] text-white relative z-10 flex items-center justify-center shadow-lg animate-in zoom-in-95 duration-400">
              <Check className="w-10 h-10 stroke-[3.5]" />
            </div>
          </div>

          <div className="space-y-2 max-w-[290px]">
            <h1 className="font-display text-[28px] font-extrabold text-[#2B1A12] leading-tight">
              Thank you for ordering!
            </h1>
            <p className="text-sm font-semibold text-[#75604F]">
              See you again.
            </p>
          </div>
        </div>

        <div className="w-full max-w-[360px] space-y-2">
          <button
            type="button"
            onClick={handleBackToHome}
            className="w-full h-[54px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[16px] flex items-center justify-center shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-transform"
          >
            Back to home
          </button>
          <p className="text-[11px] font-medium text-[#75604F]">
            Returning to home shortly…
          </p>
        </div>
      </div>
    );
  }

  const isCancelled = canonStatus === 'cancelled' || canonStatus === 'payment_cancelled';
  const isReceived = canonStatus === 'received';
  const isReady = canonStatus === 'ready';
  const isPackaging = canonStatus === 'packaging';
  const isMaking = canonStatus === 'preparing';

  // Step completion & active-ring index across the 5 timeline steps:
  // 0: Payment successful, 1: Making, 2: Packaging, 3: Ready for pickup, 4: Picked up
  // A step becomes ticked only once it is done (Making ticks when Packaging starts, etc.).
  let completedCount = 0;
  let currentStepIndex: number | null = null;

  if (canonStatus === 'pending') {
    completedCount = 1; // Payment successful ticked; Making stays upcoming
    currentStepIndex = null;
  } else if (isMaking) {
    completedCount = 1; // Payment successful ticked; Making is current (ring + making_at)
    currentStepIndex = 1;
  } else if (isPackaging) {
    completedCount = 2; // Payment successful & Making ticked; Packaging is current (ring + packaging_at)
    currentStepIndex = 2;
  } else if (isReady) {
    completedCount = 4; // Payment successful, Making, Packaging & Ready for pickup ticked; Picked up upcoming
    currentStepIndex = null;
  } else if (isReceived) {
    completedCount = 5; // All 5 steps ticked
    currentStepIndex = null;
  } else if (canonStatus === 'pending_payment') {
    completedCount = 0;
    currentStepIndex = 0;
  }

  const orderNum = order.id
    ? `#ZC-${order.id.replace(/-/g, '').slice(-4).toUpperCase()}`
    : '#ZC-2481';

  const itemCount = Array.isArray(order.items)
    ? order.items.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0)
    : 0;

  let headerPillText = 'PAYMENT SUCCESSFUL';
  let headerTitle = 'Order received';
  let headerSubtitle = 'Waiting for the outlet to confirm your order.';

  if (isMaking) {
    headerPillText = 'MAKING';
    headerTitle = "We're making\nyour order";
    headerSubtitle = 'Our kitchen is freshly preparing your items.';
  } else if (isPackaging) {
    headerPillText = 'PACKAGING';
    headerTitle = 'Packing\nyour order';
    headerSubtitle = 'Almost ready! We are packing your items.';
  } else if (isReady) {
    headerPillText = 'READY';
    headerTitle = 'Your order is ready\nfor pickup';
    headerSubtitle = 'Show your pickup code at the counter.';
  } else if (isReceived) {
    headerPillText = 'PICKED UP';
    headerTitle = 'Enjoy your order!';
    headerSubtitle = 'Thank you for ordering! See you again.';
  } else if (isCancelled) {
    headerPillText = 'CANCELLED';
    headerTitle = canonStatus === 'payment_cancelled' ? 'Payment\ncancelled' : 'Order\ncancelled';
    headerSubtitle =
      order.cancel_reason ||
      (canonStatus === 'payment_cancelled'
        ? 'Your payment was not completed.'
        : 'This order was cancelled by the outlet.');
  }

  // 5 Timeline Steps in exact order, using IST timestamps
  const paidTimestamp = order.paid_at || (canonStatus !== 'pending_payment' ? order.created_at : null);
  const timelineSteps = [
    {
      id: 'paid',
      label: 'Payment successful',
      time: formatTimeIST(paidTimestamp),
    },
    {
      id: 'making',
      label: 'Making',
      time: formatTimeIST(order.making_at),
    },
    {
      id: 'packaging',
      label: 'Packaging',
      time: formatTimeIST(order.packaging_at),
    },
    {
      id: 'ready',
      label: 'Ready for pickup',
      time: formatTimeIST(order.ready_at),
    },
    {
      id: 'received',
      label: 'Picked up',
      time: formatTimeIST(order.received_at),
    },
  ];

  const showPickupCodeCard = !isReceived && !isCancelled && canonStatus !== 'pending_payment';

  return (
    <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col justify-between pb-[max(32px,env(safe-area-inset-bottom))] page-transition select-none">
      <div>
        {/* Orange Header */}
        <div
          className={`relative bg-[#CE5535] rounded-b-[32px] p-5 pt-4 ${
            showPickupCodeCard ? 'pb-14' : 'pb-7'
          } text-white overflow-hidden shadow-md`}
        >
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              aria-label="Back to home"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </Link>

            <span className="font-extrabold text-sm text-white/95">Order {orderNum}</span>

            {order.outlet_phone ? (
              <a
                href={`tel:+91${order.outlet_phone}`}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                title="Call outlet"
                aria-label="Call outlet"
              >
                <Phone className="w-4 h-4 fill-white" />
              </a>
            ) : (
              <div className="w-10 h-10" />
            )}
          </div>

          <div
            data-testid="track-status-badge"
            className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFFEF7] text-[#CE5535] text-[11px] font-black tracking-wider uppercase mb-3 shadow-xs"
          >
            {headerPillText}
          </div>

          <h1 className="font-display text-[30px] font-extrabold text-white leading-[1.12] mb-2 tracking-tight whitespace-pre-line">
            {headerTitle}
          </h1>

          <p className="text-xs text-white/85 font-medium max-w-[240px] leading-relaxed">
            {headerSubtitle}
          </p>

          <div className="absolute right-0 -bottom-2 w-[130px] h-[170px] pointer-events-none">
            <SafeImage
              src="/assets/mascot-cream.v1.webp"
              alt="Zécha Mascot"
              fill
              sizes="130px"
              transparent
              className="object-contain object-bottom-right opacity-90"
            />
          </div>
        </div>

        {/* Floating Pickup-Code Card (shown until picked up) */}
        {showPickupCodeCard && (
          <div className="px-5 -mt-8 relative z-20" data-testid="track-pickup-card">
            <div className="bg-[#2B1A12] rounded-[22px] p-4 px-5 text-[#FDFBEA] shadow-[0_12px_28px_rgba(43,26,18,0.25)] flex items-center justify-between border border-[#2B1A12]">
              <div>
                <span className="text-[11px] font-bold text-[#FDFBEA]/70 uppercase tracking-wider block">
                  Pickup code
                </span>
                <span className="font-display text-[30px] font-black text-[#FDFBEA] tracking-widest block leading-tight mt-0.5">
                  {order.pickup_code || '7309'}
                </span>
              </div>

              <div className="w-12 h-12 rounded-[14px] bg-white/10 flex items-center justify-center text-white/90">
                <QrCode className="w-6 h-6 stroke-[2]" />
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-5 pt-6 space-y-6">
          {/* Already picked-up note when opened later */}
          {isReceived && (
            <div className="bg-[#EBF7EE] border border-[#2F7A3E]/30 rounded-[20px] p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#2F7A3E] text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-[#2B1A12]">
                  Thank you for ordering! See you again.
                </p>
                <p className="text-xs text-[#75604F] font-medium">
                  This order has been picked up.
                </p>
              </div>
            </div>
          )}

          {/* 5-step Order Status Vertical Timeline */}
          <div data-testid="track-timeline">
            <h2 className="font-display text-[18px] font-extrabold text-[#2B1A12] mb-4 tracking-tight">
              Order status
            </h2>

            <div className="space-y-0 relative pl-2">
              {timelineSteps.map((step, idx) => {
                const isStepCompleted = !isCancelled && idx < completedCount;
                const isStepCurrent = !isCancelled && currentStepIndex === idx;
                const isLast = idx === timelineSteps.length - 1;

                return (
                  <div
                    key={step.id}
                    data-step-id={step.id}
                    data-step-state={isStepCompleted ? 'completed' : isStepCurrent ? 'current' : 'future'}
                    className="relative flex items-start gap-4 pb-6 last:pb-0"
                  >
                    {!isLast && (
                      <div
                        className={`absolute left-[13px] top-[26px] bottom-0 w-[2px] ${
                          isStepCompleted ? 'bg-[#2B1A12]' : 'bg-[#EADFC7]'
                        }`}
                      />
                    )}

                    <div className="relative z-10 shrink-0">
                      {isStepCompleted ? (
                        <div className="w-7 h-7 rounded-full bg-[#2B1A12] text-white flex items-center justify-center shadow-xs">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : isStepCurrent ? (
                        <div className="w-7 h-7 rounded-full bg-[#FBEDE3] border-2 border-[#CE5535] flex items-center justify-center shadow-xs animate-pulse">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#CE5535]" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#F4E7CC] border border-[#EADFC7] flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-[#75604F]/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex items-center justify-between pt-0.5">
                      <span
                        className={`text-[15px] font-extrabold ${
                          isStepCompleted
                            ? 'text-[#2B1A12]'
                            : isStepCurrent
                            ? 'text-[#CE5535]'
                            : 'text-[#75604F]/55'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          isStepCompleted || isStepCurrent
                            ? 'text-[#75604F]'
                            : 'text-[#75604F]/40'
                        }`}
                      >
                        {isStepCompleted || isStepCurrent ? step.time || '--:--' : '--:--'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outlet Card */}
          <div className="bg-[#FFFEF7] rounded-[22px] border border-[#EADFC7] p-4 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[12px] bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-[15px] text-[#2B1A12] truncate leading-tight">
                  {order.outlet_name || 'Deleted outlet'}
                </h3>
                <p className="text-[12px] text-[#75604F] mt-0.5 truncate font-medium">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatPrice(order.total)} paid
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA for picked-up or cancelled orders */}
      {(isReceived || isCancelled) && (
        <div className="p-5 pt-2">
          <button
            type="button"
            onClick={handleBackToHome}
            className="w-full h-[54px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[16px] flex items-center justify-center shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-transform"
          >
            Back to home
          </button>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
