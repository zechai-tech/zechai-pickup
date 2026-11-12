'use client';

import React, { useEffect, useState, Suspense } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';

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

function formatTime12(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const m = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${m} ${ampm}`;
}

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');
  const urlCode = searchParams.get('code');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async (isSilent = false) => {
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
        setOrder(data.order);
        setError(null);
        if (data.order.id) {
          sessionStorage.setItem('activeOrderId', data.order.id);
        }
        if (data.order.pickup_code) {
          sessionStorage.setItem('activeOrderCode', data.order.pickup_code);
        }
      }
    } catch (e: any) {
      if (!isSilent) setError(e.message || 'Error fetching order');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder(false);

    // Poll every 5 seconds (real data, no fake times)
    const intervalId = setInterval(() => {
      fetchOrder(true);
    }, 5000);

    // Poll on window focus
    const handleFocus = () => fetchOrder(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [urlId, urlCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center space-y-4">
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
          Go to Home
        </Link>
      </div>
    );
  }

  const status = (order.status || 'pending').toLowerCase();
  const isCancelled = ['cancelled', 'payment_cancelled', 'payment_failed'].includes(status);
  const isReceived = status === 'received' || status === 'completed';
  const isReady = status === 'ready';
  const isPackaging = status === 'packaging';
  const isMaking = status === 'preparing' || status === 'confirmed';
  const isPending = status === 'pending' || status === 'pending_payment';

  // Order timeline stage index (0 to 3)
  // Stage 0: Payment successful
  // Stage 1: Making
  // Stage 2: Packaging
  // Stage 3: Ready for pickup
  let currentStageIndex = 0;
  if (isMaking) currentStageIndex = 1;
  else if (isPackaging) currentStageIndex = 2;
  else if (isReady || isReceived) currentStageIndex = 3;

  const orderNum = order.id
    ? `#ZC-${order.id.replace(/-/g, '').slice(-4).toUpperCase()}`
    : '#ZC-2481';

  const itemCount = Array.isArray(order.items)
    ? order.items.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0)
    : 0;

  // Header Title & Pill text based on status
  let headerPillText = 'ORDER CONFIRMED';
  let headerTitle = 'Order received';
  let headerSubtitle = 'The kitchen has received your order.';

  if (isMaking) {
    headerPillText = `MAKING · ${formatTime12(order.making_at) || formatTime12(order.created_at)}`;
    headerTitle = "We're making\nyour order";
    headerSubtitle = 'Our kitchen is freshly preparing your items.';
  } else if (isPackaging) {
    headerPillText = `PACKAGING · ${formatTime12(order.packaging_at) || formatTime12(new Date())}`;
    headerTitle = 'Packaging\nyour order';
    headerSubtitle = 'Almost ready! We are packing your items.';
  } else if (isReady) {
    headerPillText = `READY · ${formatTime12(order.ready_at) || formatTime12(new Date())}`;
    headerTitle = 'Your order\nis ready!';
    headerSubtitle = 'Head to the counter and show your pickup code.';
  } else if (isReceived) {
    headerPillText = `COLLECTED · ${formatTime12(order.received_at) || formatTime12(new Date())}`;
    headerTitle = 'Order\ncollected!';
    headerSubtitle = 'Thank you for choosing Zécha! Enjoy your order.';
  } else if (isCancelled) {
    headerPillText = 'CANCELLED';
    headerTitle = 'Order\ncancelled';
    headerSubtitle = order.cancel_reason || 'This order was cancelled by the outlet.';
  }

  // 4 Timeline Steps with REAL timestamps from database
  const timelineSteps = [
    {
      id: 'paid',
      label: 'Payment successful',
      time: formatTime12(order.paid_at || order.created_at),
      stageIdx: 0,
    },
    {
      id: 'making',
      label: 'Making',
      time: formatTime12(order.making_at),
      stageIdx: 1,
    },
    {
      id: 'packaging',
      label: 'Packaging',
      time: formatTime12(order.packaging_at),
      stageIdx: 2,
    },
    {
      id: 'ready',
      label: 'Ready for pickup',
      time: formatTime12(order.ready_at),
      stageIdx: 3,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBEA] flex flex-col justify-between pb-12 page-transition select-none">
      <div>
        {/* Header Block: Accent bg (#CE5535), bottom corners 32px, cup mascot art bottom-right */}
        <div className="relative bg-[#CE5535] rounded-b-[32px] p-5 pt-4 pb-14 text-white overflow-hidden shadow-md">
          {/* Top navigation row: back button, Order #no, call outlet button */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/"
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              aria-label="Back to home"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </Link>

            <span className="font-extrabold text-sm text-white/95">
              Order {orderNum}
            </span>

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

          {/* Current State Pill */}
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFFEF7] text-[#CE5535] text-[11px] font-black tracking-wider uppercase mb-3 shadow-xs">
            {headerPillText}
          </div>

          {/* Big Title */}
          <h1 className="font-display text-[32px] font-extrabold text-white leading-[1.1] mb-2 tracking-tight whitespace-pre-line">
            {headerTitle}
          </h1>

          {/* Subtitle helper line */}
          <p className="text-xs text-white/85 font-medium max-w-[240px] leading-relaxed">
            {headerSubtitle}
          </p>

          {/* Mascot Art Peeking bottom-right */}
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

        {/* Floating Dark Pickup-Code Card overlapping the header */}
        <div className="px-5 -mt-8 relative z-20">
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

        {/* Main Content Area */}
        <div className="p-5 pt-6 space-y-6">
          {/* Order Status Vertical Timeline (4 steps) */}
          <div>
            <h2 className="font-display text-[18px] font-extrabold text-[#2B1A12] mb-4 tracking-tight">
              Order status
            </h2>

            <div className="space-y-0 relative pl-2">
              {timelineSteps.map((step, idx) => {
                const isStepCompleted = isReceived || currentStageIndex > step.stageIdx;
                const isStepCurrent = !isReceived && currentStageIndex === step.stageIdx;
                const isStepFuture = !isReceived && currentStageIndex < step.stageIdx;
                const isLast = idx === timelineSteps.length - 1;

                return (
                  <div key={step.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                    {/* Vertical Connector Line */}
                    {!isLast && (
                      <div
                        className={`absolute left-[13px] top-[26px] bottom-0 w-[2px] ${
                          isStepCompleted ? 'bg-[#2B1A12]' : 'bg-[#EADFC7]'
                        }`}
                      />
                    )}

                    {/* Step Icon / Dot */}
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

                    {/* Step Label & Real Timestamp */}
                    <div className="flex-1 flex items-center justify-between pt-0.5">
                      <span
                        className={`text-[15px] font-extrabold ${
                          isStepCompleted || isStepCurrent
                            ? isStepCurrent
                              ? 'text-[#CE5535]'
                              : 'text-[#2B1A12]'
                            : 'text-[#75604F]/60'
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
                        {step.time || '--:--'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outlet Card: Cup tile, outlet name, N items · ₹<amount> paid */}
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

      {/* Bottom CTA when status is ready or received: "Back to home" */}
      {(isReady || isReceived) && (
        <div className="p-5 pt-2">
          <Link
            href="/"
            className="w-full h-[56px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[16px] flex items-center justify-center shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-all"
          >
            Back to home
          </Link>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
