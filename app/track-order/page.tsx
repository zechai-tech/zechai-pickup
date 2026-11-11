'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Check,
  Phone,
  AlertCircle,
  XCircle,
  ShoppingBag,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { getCustomerStageState } from '@/lib/order-flow';

interface OrderItem {
  id?: string;
  name: string;
  price: number;
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
  kitchen_note?: string;
  created_at?: string;
  outlet_name?: string;
}

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');
  const urlCode = searchParams.get('code');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const code = order?.pickup_code || urlCode || '';

  const fetchOrder = async (isSilent = false) => {
    const targetId =
      urlId || (typeof window !== 'undefined' ? localStorage.getItem('activeOrderId') : null);
    const targetCode =
      urlCode ||
      (!targetId && typeof window !== 'undefined' ? localStorage.getItem('activeOrderCode') : null);

    if (!targetId && !targetCode) {
      if (!isSilent) {
        setError('No order id or pickup code provided');
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
          localStorage.setItem('activeOrderId', data.order.id);
        }
        if (data.order.pickup_code) {
          localStorage.setItem('activeOrderCode', data.order.pickup_code);
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

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          fetchOrder(true);
        }, 4000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchOrder(true);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [urlId, urlCode]);

  const stageProgress = getCustomerStageState(order?.status);
  const { canonicalStatus, isCancelled, isPaymentCancelled, isReady, isReceived } = stageProgress;
  const getStageState = (stageNumber: number) => stageProgress.getStage(stageNumber);

  const stages = [
    {
      num: 1,
      title: 'Payment Received',
      desc:
        canonicalStatus === 'pending'
          ? 'Payment received. Waiting for the outlet to confirm your order.'
          : 'Payment received successfully.',
    },
    {
      num: 2,
      title: 'Order Confirmed',
      desc: 'Your order is accepted by the kitchen staff.',
    },
    {
      num: 3,
      title: 'Being Made',
      desc: 'Freshly brewing your chai & frying bites right now.',
    },
    {
      num: 4,
      title: 'Packing',
      desc: 'Carefully packing your items for a clean handover.',
    },
    {
      num: 5,
      title: 'Ready for Pickup',
      desc: 'Hot and ready at the counter! Show your pickup code.',
    },
    {
      num: 6,
      title: 'Received',
      desc: 'Order handed over. Enjoy every sip of your Zécha!',
    },
  ];

  return (
    <div className="min-h-[100dvh] h-full flex flex-col bg-[#FDFBEA] page-transition overflow-hidden relative w-full max-w-full">
      {/* Header */}
      <header className="shrink-0 px-4 pt-3 pb-3 border-b border-[#EADFC7] bg-[#FDFBEA]/95 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC]/40 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <h1 className="font-display text-xl font-black text-[#2B1A12]">
            Track Order
          </h1>
        </div>

        {code && (
          <span className="font-display font-black text-sm text-[#CE5535] bg-[#FBEDE3] px-3 py-1 rounded-full border border-[#CE5535]/30">
            #{code}
          </span>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden p-4 pb-28 space-y-4 scrollbar-none touch-scroll w-full max-w-full">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 border-3 border-[#CE5535]/20 border-t-[#CE5535] rounded-full animate-spin" />
            <p className="text-xs font-semibold text-[#75604F]">
              Locating your order...
            </p>
          </div>
        ) : error || !order ? (
          <div className="bg-[#FFFEF7] rounded-3xl border border-[#EADFC7] p-6 text-center my-8 shadow-xs">
            <AlertCircle className="w-10 h-10 text-[#CE5535] mx-auto mb-2" />
            <h2 className="font-bold text-base text-[#2B1A12] mb-1">
              Order Not Found
            </h2>
            <p className="text-xs text-[#75604F] mb-4">
              We couldn&apos;t find an order matching pickup code &ldquo;{code}&rdquo;.
            </p>
            <Link
              href="/outlet"
              className="inline-block px-5 py-2.5 rounded-full bg-[#CE5535] text-white text-xs font-bold"
            >
              Go to Outlets
            </Link>
          </div>
        ) : (
          <>
            {/* Payment Cancelled Banner */}
            {isPaymentCancelled && (
              <div className="bg-[#FDF0F0] border border-[#BA1A1A]/30 text-[#BA1A1A] p-5 rounded-3xl space-y-3">
                <div className="flex items-start gap-3">
                  <XCircle className="w-6 h-6 shrink-0 text-[#BA1A1A] mt-0.5" />
                  <div>
                    <h3 className="font-bold text-sm text-[#2B1A12]">Payment not completed</h3>
                    <p className="text-xs text-[#75604F] mt-0.5 leading-relaxed">
                      Your payment was not completed or has expired. Please try placing your order again.
                    </p>
                  </div>
                </div>
                <Link
                  href="/menu"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[#BA1A1A] text-white text-xs font-bold hover:bg-[#93000A] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try again</span>
                </Link>
              </div>
            )}

            {/* Order Cancelled by Outlet Banner */}
            {isCancelled && (
              <div className="bg-[#FDF0F0] border border-[#BA1A1A]/30 p-5 rounded-3xl space-y-2.5">
                <div className="flex items-start gap-3">
                  <XCircle className="w-6 h-6 shrink-0 text-[#BA1A1A] mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-[#2B1A12]">Order cancelled by outlet</h3>
                    {order.cancel_reason && (
                      <p className="text-xs font-semibold text-[#BA1A1A]">
                        Reason: {order.cancel_reason}
                      </p>
                    )}
                    <p className="text-xs text-[#75604F] leading-relaxed pt-1 border-t border-[#BA1A1A]/15">
                      No automatic refund. Please contact the outlet for assistance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Prominent Pickup Code Card */}
            <div className="bg-[#FFFEF7] rounded-3xl border border-[#EADFC7] p-5 shadow-xs text-center relative overflow-hidden">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#75604F] block mb-1">
                Your Pickup Code
              </span>
              <div className="font-display font-black text-5xl text-[#CE5535] tracking-widest my-1 select-all">
                {order.pickup_code}
              </div>
              <p className="text-xs text-[#75604F] font-medium mt-1">
                {isReady
                  ? 'Your order is ready. Show this code to collect it.'
                  : isReceived
                  ? 'Order collected. Thank you for visiting!'
                  : 'Show this code when collecting your order'}
              </p>

              {/* Highlighted Tip Card */}
              <div className="mt-4 p-3 rounded-2xl bg-[#FBEDE3] border border-[#CE5535]/30 flex items-center gap-2.5 text-left">
                <Camera className="w-5 h-5 text-[#CE5535] shrink-0" />
                <p className="text-[11px] font-bold text-[#CE5535] leading-tight">
                  {isReady
                    ? 'Show this code at the pickup counter to collect your order.'
                    : 'Take a screenshot or remember your code. You will need it to collect your order.'}
                </p>
              </div>
            </div>

            {/* Thank you message when order is received */}
            {isReceived && (
              <div className="bg-[#EBF7EE] border border-[#2F7A3E]/30 rounded-3xl p-5 text-center space-y-1.5 shadow-xs animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full bg-[#2F7A3E] text-white flex items-center justify-center mx-auto shadow-xs">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="font-display font-black text-base text-[#2F7A3E]">
                  Thank you for your order!
                </h3>
                <p className="text-xs text-[#75604F] font-medium leading-relaxed">
                  Your order has been handed over. Enjoy every sip of your Zécha!
                </p>
              </div>
            )}

            {/* Live Progress Tracker */}
            {!isCancelled && !isPaymentCancelled && (
              <div className="bg-[#FFFEF7] rounded-3xl border border-[#EADFC7] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-black text-sm uppercase tracking-wider text-[#75604F]">
                    Live Order Progress
                  </h2>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#2F7A3E]">
                    <span className="w-2 h-2 rounded-full bg-[#2F7A3E] animate-pulse" />
                    Live Tracker
                  </span>
                </div>

                <div className="space-y-0 relative">
                  {stages.map((st, idx) => {
                    const state = getStageState(st.num);
                    const isLast = idx === stages.length - 1;

                    return (
                      <div key={st.num} className={`flex items-start gap-4 relative ${isLast ? '' : 'pb-7'}`}>
                        {/* Connecting Line */}
                        {!isLast && (
                          <div
                            className={`absolute left-4 top-8 -bottom-0 w-0.5 ${
                              state === 'completed' ? 'bg-[#2F7A3E]' : 'bg-[#EADFC7]'
                            }`}
                          />
                        )}

                        {/* Step Circle */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                            state === 'completed'
                              ? 'bg-[#2F7A3E] text-white shadow-xs'
                              : state === 'current'
                              ? 'bg-[#CE5535] text-white ring-4 ring-[#CE5535]/20 animate-pulse'
                              : 'bg-[#EADFC7] text-[#75604F]'
                          }`}
                        >
                          {state === 'completed' ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <span className="text-xs font-black">{st.num}</span>
                          )}
                        </div>

                        {/* Step Details */}
                        <div className="pt-0.5">
                          <h3
                            className={`font-bold text-sm leading-tight ${
                              state === 'current'
                                ? 'text-[#CE5535]'
                                : state === 'completed'
                                ? 'text-[#2F7A3E]'
                                : 'text-[#75604F]/60'
                            }`}
                          >
                            {st.title}
                          </h3>
                          <p
                            className={`text-xs mt-0.5 leading-relaxed ${
                              state === 'current'
                                ? 'text-[#2B1A12] font-medium'
                                : 'text-[#75604F]/70'
                            }`}
                          >
                            {st.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order Items Info Card */}
            <div className="bg-[#FFFEF7] rounded-3xl border border-[#EADFC7] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#EADFC7]">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#CE5535]" />
                  <span className="font-bold text-xs text-[#2B1A12]">
                    Order Summary
                  </span>
                </div>
                <span className="text-xs font-bold text-[#75604F]">
                  {order.items?.length || 0} items
                </span>
              </div>

              <div className="divide-y divide-[#EADFC7]/50">
                {(order.items || []).map((item, index) => {
                  const qty = item.qty || item.quantity || 1;
                  const price = item.price || 0;
                  return (
                    <div
                      key={index}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="text-[#2B1A12] font-semibold truncate pr-2">
                        <strong className="text-[#CE5535] font-black mr-1.5">
                          {qty}×
                        </strong>
                        {item.name}
                      </span>
                      <span className="font-bold text-[#2B1A12] shrink-0">
                        {formatPrice(price * qty)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {order.kitchen_note && (
                <div className="bg-[#F4E7CC]/30 rounded-xl p-2.5 text-xs text-[#75604F] border border-[#EADFC7]">
                  <span className="font-bold text-[#2B1A12] block mb-0.5">
                    Kitchen Note:
                  </span>
                  {order.kitchen_note}
                </div>
              )}

              <div className="pt-2 border-t border-[#EADFC7] flex items-center justify-between">
                <span className="text-xs font-bold text-[#75604F]">Total Amount</span>
                <span className="font-display font-black text-base text-[#2B1A12]">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Bottom: Contact Outlet Assistance */}
      <footer className="shrink-0 p-4 bg-[#FDFBEA]/95 backdrop-blur-md border-t border-[#EADFC7] z-20 pb-[max(16px,env(safe-area-inset-bottom))] w-full">
        <a
          href="tel:+919847123210"
          className="w-full h-12 rounded-2xl bg-[#FFFEF7] border border-[#EADFC7] text-[#2B1A12] hover:bg-[#F4E7CC]/40 flex items-center justify-center gap-2 text-xs font-bold shadow-xs transition-colors"
        >
          <Phone className="w-4 h-4 text-[#CE5535]" />
          <span>Need help? Contact the outlet</span>
        </a>
      </footer>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#FDFBEA] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CE5535]" />
        </div>
      }
    >
      <TrackOrderContent />
    </Suspense>
  );
}
