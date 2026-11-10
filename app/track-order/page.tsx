'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Check,
  Clock,
  Phone,
  AlertCircle,
  XCircle,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';

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
  total: number;
  items: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
  kitchen_note?: string;
  created_at?: string;
  outlet_id?: string;
}

function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async (isSilent = false) => {
    if (!code) {
      setError('No pickup code provided');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchErr } = await (supabase.from('orders') as any)
        .select('*')
        .eq('pickup_code', code)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchErr) {
        if (!isSilent) setError('Order not found');
      } else if (data) {
        setOrder(data);
        setError(null);
      }
    } catch (e: any) {
      if (!isSilent) setError(e.message || 'Error fetching order');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Auto-refresh every 6 seconds to track kitchen progress live
    const interval = setInterval(() => {
      fetchOrder(true);
    }, 6000);

    return () => clearInterval(interval);
  }, [code]);

  // Stepper logic
  // Steps: 1: confirmed, 2: preparing, 3: ready, 4: completed
  const getStepState = (targetStep: number) => {
    if (!order) return 'future';

    const status = order.status;
    let currentStepNumber = 1;

    if (status === 'confirmed') currentStepNumber = 1;
    else if (status === 'preparing') currentStepNumber = 2;
    else if (status === 'ready') currentStepNumber = 3;
    else if (status === 'completed' || status === 'picked_up') currentStepNumber = 4;
    else currentStepNumber = 0;

    if (targetStep < currentStepNumber) return 'completed';
    if (targetStep === currentStepNumber) return 'current';
    return 'future';
  };

  const isCancelled = order?.status === 'cancelled';
  const isPaymentFailed = order?.status === 'payment_failed';

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
            {/* Status Banners for edge states */}
            {isCancelled && (
              <div className="bg-[#FDF0F0] border border-[#BA1A1A]/30 text-[#BA1A1A] p-4 rounded-2xl flex items-center gap-3">
                <XCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm">This order was cancelled</h3>
                  <p className="text-xs opacity-90 mt-0.5">
                    Please visit the counter or place a new order.
                  </p>
                </div>
              </div>
            )}

            {isPaymentFailed && (
              <div className="bg-[#FDF0F0] border border-[#BA1A1A]/30 text-[#BA1A1A] p-4 rounded-2xl flex items-center gap-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm">Payment failed</h3>
                  <p className="text-xs opacity-90 mt-0.5">
                    Your payment was not completed. Please try again.
                  </p>
                </div>
              </div>
            )}

            {/* Prominent Pickup Code Card */}
            <div className="bg-[#FFFEF7] rounded-3xl border border-[#EADFC7] p-5 shadow-xs text-center relative overflow-hidden">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#75604F] block mb-1">
                Your Pickup Code
              </span>
              <div className="font-display font-black text-5xl text-[#CE5535] tracking-widest my-1">
                {order.pickup_code}
              </div>
              <p className="text-xs text-[#75604F] font-medium mt-1">
                Show this code when collecting your order
              </p>
            </div>

            {/* Vertical Stepper / Timeline */}
            {!isCancelled && !isPaymentFailed && (
              <div className="bg-[#FFFEF7] rounded-3xl border border-[#EADFC7] p-6 shadow-xs">
                <h2 className="font-display font-black text-sm uppercase tracking-wider text-[#75604F] mb-6">
                  Live Order Status
                </h2>

                <div className="space-y-0 relative">
                  {/* Step 1: Order Confirmed */}
                  {(() => {
                    const state = getStepState(1);
                    return (
                      <div className="flex items-start gap-4 relative pb-8">
                        {/* Connecting Line to next step */}
                        <div
                          className={`absolute left-4 top-8 -bottom-0 w-0.5 ${
                            state === 'completed' ? 'bg-[#2F7A3E]' : 'bg-[#D4D4D4]'
                          }`}
                        />

                        {/* Step Circle */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                            state === 'completed'
                              ? 'bg-[#2F7A3E] text-white shadow-sm'
                              : state === 'current'
                              ? 'bg-[#CE5535] text-white ring-4 ring-[#CE5535]/20 animate-pulse'
                              : 'bg-[#D4D4D4] text-white'
                          }`}
                        >
                          {state === 'completed' ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <span className="text-xs font-black">1</span>
                          )}
                        </div>

                        {/* Step Label */}
                        <div className="pt-1">
                          <h3
                            className={`font-bold text-sm leading-tight ${
                              state === 'current'
                                ? 'text-[#CE5535]'
                                : state === 'completed'
                                ? 'text-[#2F7A3E]'
                                : 'text-[#75604F]/60'
                            }`}
                          >
                            Order Confirmed
                          </h3>
                          <p className="text-xs text-[#75604F]/70 mt-0.5">
                            Order received & sent to the counter
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 2: Preparing your order */}
                  {(() => {
                    const state = getStepState(2);
                    return (
                      <div className="flex items-start gap-4 relative pb-8">
                        {/* Connecting Line */}
                        <div
                          className={`absolute left-4 top-8 -bottom-0 w-0.5 ${
                            state === 'completed' ? 'bg-[#2F7A3E]' : 'bg-[#D4D4D4]'
                          }`}
                        />

                        {/* Step Circle */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                            state === 'completed'
                              ? 'bg-[#2F7A3E] text-white shadow-sm'
                              : state === 'current'
                              ? 'bg-[#CE5535] text-white ring-4 ring-[#CE5535]/20 animate-pulse'
                              : 'bg-[#D4D4D4] text-white'
                          }`}
                        >
                          {state === 'completed' ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : state === 'current' ? (
                            <Clock className="w-4 h-4 animate-spin stroke-[2.5]" />
                          ) : (
                            <span className="text-xs font-black">2</span>
                          )}
                        </div>

                        {/* Step Label */}
                        <div className="pt-1">
                          <h3
                            className={`font-bold text-sm leading-tight ${
                              state === 'current'
                                ? 'text-[#CE5535]'
                                : state === 'completed'
                                ? 'text-[#2F7A3E]'
                                : 'text-[#75604F]/60'
                            }`}
                          >
                            Preparing your order
                          </h3>
                          <p className="text-xs text-[#75604F]/70 mt-0.5">
                            Freshly brewing your chai & frying bites
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 3: Ready for pickup! */}
                  {(() => {
                    const state = getStepState(3);
                    return (
                      <div className="flex items-start gap-4 relative pb-8">
                        {/* Connecting Line */}
                        <div
                          className={`absolute left-4 top-8 -bottom-0 w-0.5 ${
                            state === 'completed' ? 'bg-[#2F7A3E]' : 'bg-[#D4D4D4]'
                          }`}
                        />

                        {/* Step Circle */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                            state === 'completed'
                              ? 'bg-[#2F7A3E] text-white shadow-sm'
                              : state === 'current'
                              ? 'bg-[#CE5535] text-white ring-4 ring-[#CE5535]/20 animate-bounce'
                              : 'bg-[#D4D4D4] text-white'
                          }`}
                        >
                          {state === 'completed' ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : state === 'current' ? (
                            <Sparkles className="w-4 h-4 stroke-[2.5]" />
                          ) : (
                            <span className="text-xs font-black">3</span>
                          )}
                        </div>

                        {/* Step Label */}
                        <div className="pt-1">
                          <h3
                            className={`font-bold text-sm leading-tight ${
                              state === 'current'
                                ? 'text-[#CE5535] font-black'
                                : state === 'completed'
                                ? 'text-[#2F7A3E]'
                                : 'text-[#75604F]/60'
                            }`}
                          >
                            Ready for pickup!
                          </h3>
                          <p className="text-xs text-[#75604F]/70 mt-0.5">
                            Head to the counter and show code #{order.pickup_code}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 4: Completed */}
                  {(() => {
                    const state = getStepState(4);
                    return (
                      <div className="flex items-start gap-4 relative">
                        {/* Step Circle */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                            state === 'completed' || state === 'current'
                              ? 'bg-[#2F7A3E] text-white shadow-sm'
                              : 'bg-[#D4D4D4] text-white'
                          }`}
                        >
                          {state === 'completed' || state === 'current' ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <span className="text-xs font-black">4</span>
                          )}
                        </div>

                        {/* Step Label */}
                        <div className="pt-1">
                          <h3
                            className={`font-bold text-sm leading-tight ${
                              state === 'completed' || state === 'current'
                                ? 'text-[#2F7A3E]'
                                : 'text-[#75604F]/60'
                            }`}
                          >
                            Completed
                          </h3>
                          <p className="text-xs text-[#75604F]/70 mt-0.5">
                            Enjoy your Zécha! One cup every day.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
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
