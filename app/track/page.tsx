'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Check,
  MapPin,
  X,
  Gauge,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { fireConfetti } from '@/components/track/Confetti';
import { cn, formatPrice, formatTime, getEstimatedReadyTime } from '@/lib/utils';
import { OrderStatus } from '@/types';

export default function TrackPage() {
  const router = useRouter();
  const {
    activeOrder,
    updateOrderStatus,
    demoSpeed,
    setDemoSpeed,
    clearOrder,
  } = useZechaStore();
  const { showToast } = useToast();

  const [showQrModal, setShowQrModal] = useState(false);
  const notifiedReadyRef = useRef(false);

  // Route guard: /track redirects to / only when there is no order
  useEffect(() => {
    if (!activeOrder) {
      router.push('/');
    }
  }, [activeOrder, router]);

  // Timer simulation loop based on timestamps and demoSpeed
  useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.status === 'ready' || activeOrder.status === 'picked_up') return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - activeOrder.placedAt;
      const speed = demoSpeed; // 1 or 4

      const acceptedDelay = 5000 / speed;
      const preparingDelay = 12000 / speed;
      const readyDelay = 25000 / speed;

      let nextStatus: OrderStatus = activeOrder.status;

      if (elapsed >= readyDelay) {
        nextStatus = 'ready';
      } else if (elapsed >= preparingDelay) {
        nextStatus = 'preparing';
      } else if (elapsed >= acceptedDelay) {
        nextStatus = 'accepted';
      }

      if (nextStatus !== activeOrder.status) {
        updateOrderStatus(nextStatus);
        if (nextStatus === 'ready' && !notifiedReadyRef.current) {
          notifiedReadyRef.current = true;
          fireConfetti();
          showToast('Your order is ready!', 'success');
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [activeOrder, demoSpeed, updateOrderStatus, showToast]);

  // When loaded directly as ready, fire confetti once
  useEffect(() => {
    if (activeOrder?.status === 'ready' && !notifiedReadyRef.current) {
      notifiedReadyRef.current = true;
      fireConfetti();
    }
  }, [activeOrder?.status]);

  if (!activeOrder) return null;

  const isReady = activeOrder.status === 'ready';

  // Format timestamps for timeline steps
  const placedTimeStr = formatTime(new Date(activeOrder.placedAt));
  const acceptedTimeStr = formatTime(new Date(activeOrder.placedAt + 60 * 1000));
  const preparingTimeStr = formatTime(new Date(activeOrder.placedAt + 120 * 1000));
  const readyTimeStr = formatTime(new Date(activeOrder.placedAt + 11 * 60 * 1000));
  const estimatedTimeStr = getEstimatedReadyTime(new Date(activeOrder.placedAt), 12);

  // Status badge text while in progress
  const inProgressBadgeText =
    activeOrder.status === 'placed'
      ? 'PLACED'
      : activeOrder.status === 'accepted'
      ? 'ACCEPTED'
      : 'PREPARING';

  const steps = [
    {
      id: 'placed',
      title: 'Order placed & paid',
      time: placedTimeStr,
      isDone: activeOrder.status === 'accepted' || activeOrder.status === 'preparing' || isReady,
      isCurrent: activeOrder.status === 'placed',
    },
    {
      id: 'accepted',
      title: 'Accepted by outlet',
      time: acceptedTimeStr,
      isDone: activeOrder.status === 'preparing' || isReady,
      isCurrent: activeOrder.status === 'accepted',
    },
    {
      id: 'preparing',
      title: 'Preparing your order',
      time: preparingTimeStr,
      isDone: isReady,
      isCurrent: activeOrder.status === 'preparing',
    },
    {
      id: 'ready',
      title: 'Ready for pickup',
      time: readyTimeStr,
      isDone: isReady,
      isCurrent: isReady,
    },
  ];

  const handlePickUp = () => {
    clearOrder();
    showToast('Order completed! Enjoy your Zécha brew ☕️', 'success');
    router.push('/');
  };

  return (
    <div className="min-h-[100dvh] h-full flex flex-col bg-cream page-transition overflow-hidden relative w-full max-w-full">
      {/* Scrollable Container */}
      <main className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden pb-28 scrollbar-none touch-scroll w-full max-w-full">
        {/* Top Orange Header matching design */}
        <div className="bg-orange text-cream pt-3.5 pb-10 px-4 rounded-b-[32px] relative overflow-hidden shadow-md">
          {/* Mascot Cream Graphic on right */}
          <div className="absolute right-1 -bottom-2 w-32 h-40 opacity-95 pointer-events-none">
            <SafeImage
              src="/assets/mascot-cream.v1.webp"
              alt="Zécha Mascot"
              fill
              sizes="128px"
              transparent
              className="object-contain object-right"
            />
          </div>

          {/* Top Bar: Back button, Order ID, Demo Speed */}
          <div className="flex items-center justify-between mb-3.5 relative z-10">
            <Link
              href="/"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-cream transition-colors"
              aria-label="Back to home"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            </Link>

            <span className="font-bold text-sm tracking-wide text-cream">
              Order #{activeOrder.id}
            </span>

            {/* Demo Speed Toggle */}
            <button
              onClick={() => setDemoSpeed(demoSpeed === 1 ? 4 : 1)}
              className="px-2.5 py-1 rounded-full bg-cream/20 hover:bg-cream/30 text-[10px] font-black uppercase tracking-wider text-cream flex items-center gap-1 transition-colors"
              title="Toggle demo simulation speed"
            >
              <Gauge className="w-3 h-3 text-mustard" />
              <span>{demoSpeed === 4 ? 'Fast 4×' : 'Normal'}</span>
            </button>
          </div>

          {/* Header State Content */}
          <div className="relative z-10 pt-1">
            {isReady ? (
              <>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cream text-orange text-[10px] font-black uppercase tracking-wider mb-2 shadow-xs">
                  <span>READY · {readyTimeStr}</span>
                </div>
                <h1 className="font-display text-2xl font-black text-cream leading-tight mb-1 max-w-[210px]">
                  Your order<br />is ready!
                </h1>
                <p className="text-[11px] font-medium text-cream/90 max-w-[200px]">
                  Head to the counter and show your pickup code.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cream text-orange text-[10px] font-black uppercase tracking-wider mb-2 shadow-xs">
                  <span>{inProgressBadgeText}</span>
                </div>
                <h1 className="font-display text-2xl font-black text-cream leading-tight mb-1 max-w-[220px]">
                  We&apos;re getting<br />it ready
                </h1>
                <p className="text-[11px] font-medium text-cream/90 max-w-[220px]">
                  Estimated ready by {estimatedTimeStr}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Espresso Card Overlapping Header */}
        <div className="px-4 -mt-6 relative z-20">
          <div
            onClick={() => setShowQrModal(true)}
            className="bg-espresso text-cream rounded-[20px] p-3.5 px-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all shadow-lg border border-espresso-dark"
          >
            <div>
              <span className="text-[10px] font-semibold text-cream/60 block">
                Pickup code
              </span>
              <span className="font-display text-3xl font-black tracking-widest text-cream">
                {activeOrder.code}
              </span>
            </div>

            <div className="w-12 h-12 rounded-xl bg-card text-espresso flex items-center justify-center shadow-xs p-1">
              <QRCodeSVG value={`${activeOrder.id}-${activeOrder.code}`} size={36} />
            </div>
          </div>
        </div>

        {/* Order Status Timeline Section */}
        <div className="p-4 pt-4 space-y-4">
          <div>
            <h2 className="font-display text-base font-black text-espresso mb-3">
              Order status
            </h2>

            {/* Vertical Stepper Timeline */}
            <div className="relative pl-6 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-3 before:w-0.5 before:bg-border">
              {steps.map((step) => (
                <div key={step.id} className="relative flex items-center justify-between">
                  {/* Step icon dot */}
                  <div
                    className={cn(
                      'absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-xs',
                      step.isDone
                        ? 'bg-espresso text-cream'
                        : step.isCurrent
                        ? 'bg-orange text-cream ring-4 ring-orange/20 animate-pulse'
                        : 'bg-sand border-2 border-border text-transparent'
                    )}
                  >
                    {step.isDone ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : step.isCurrent ? (
                      <div className="w-2 h-2 rounded-full bg-cream" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-border" />
                    )}
                  </div>

                  {/* Title and Time */}
                  <span
                    className={cn(
                      'text-xs font-bold',
                      step.isDone || step.isCurrent ? 'text-espresso' : 'text-espresso/45 font-medium'
                    )}
                  >
                    {step.title}
                  </span>

                  <span className="text-[11px] font-semibold text-espresso/50 tabular-nums">
                    {step.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Outlet Details Card */}
          <div className="bg-card rounded-card border border-border p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sand/60 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-orange" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-espresso leading-snug">
                  {activeOrder.outlet?.name || 'Deleted outlet'}
                </h4>
                <p className="text-[11px] text-espresso/60 font-medium">
                  {activeOrder.items.reduce((s, i) => s + i.qty, 0)} items · {formatPrice(activeOrder.paidAmount)} paid
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom "I have picked it up" Button */}
      <div className="shrink-0 p-3.5 bg-cream/95 backdrop-blur-md border-t border-border z-30 pb-[max(16px,env(safe-area-inset-bottom))] w-full">
        <Button
          onClick={handlePickUp}
          className="w-full h-12 text-[16px] font-bold shadow-orange active:scale-[0.98]"
        >
          I have picked it up
        </Button>
      </div>

      {/* Full QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-espresso/70 backdrop-blur-sm flex items-center justify-center p-6 overscroll-contain animate-in fade-in duration-150">
          <div className="bg-card w-full max-w-[280px] rounded-card-lg p-5 flex flex-col items-center text-center shadow-2xl border border-border relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-sand/60 flex items-center justify-center text-espresso"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-black uppercase tracking-widest text-orange mb-1">
              PICKUP VERIFICATION
            </span>
            <h3 className="font-display text-lg font-black text-espresso mb-3">
              Code: {activeOrder.code}
            </h3>

            <div className="p-3 bg-white rounded-2xl border border-border shadow-inner mb-3">
              <QRCodeSVG
                value={`${activeOrder.id}-${activeOrder.code}`}
                size={160}
              />
            </div>

            <p className="text-[11px] text-espresso/70 font-medium">
              Scan at the counter or show your 4-digit code.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
