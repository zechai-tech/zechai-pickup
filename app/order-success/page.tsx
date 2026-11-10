'use client';

import React, { useEffect, useState, Suspense } from 'react';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowRight, Store, Clock } from 'lucide-react';
import { useZechaStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Order } from '@/types/supabase';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '----';
  const outletParam = searchParams.get('outlet');

  const { outlet, clearCart } = useZechaStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clear cart on success mount
    clearCart();

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, outlet:outlets(*)')
          .eq('pickup_code', code)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setOrder(data as Order);
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (code && code !== '----') {
      fetchOrder();
    } else {
      setLoading(false);
    }
  }, [code, clearCart]);

  const outletName =
    outletParam ||
    order?.outlet?.name ||
    outlet?.name ||
    'Zécha! Thamarassery';

  const itemsList = order?.items || [];

  return (
    <div className="min-h-[100dvh] h-full flex flex-col bg-cream page-transition overflow-hidden relative w-full max-w-full">
      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden p-5 pb-24 scrollbar-none touch-scroll w-full max-w-full">
        {/* Success Badge */}
        <div className="text-center pt-6 pb-4">
          <div className="w-16 h-16 rounded-full bg-brandGreen/15 text-brandGreen flex items-center justify-center mx-auto mb-3 shadow-xs">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-espresso tracking-tight">
            Payment Successful!
          </h1>
          <p className="text-xs text-espresso/60 font-medium mt-1">
            Your order has been sent to the kitchen
          </p>
        </div>

        {/* Pickup Code Hero Card */}
        <div className="bg-card rounded-[28px] border-2 border-border p-6 text-center shadow-md my-2 max-w-sm mx-auto w-full overflow-hidden">
          <span className="text-[11px] font-black uppercase tracking-widest text-espresso/60 block mb-2">
            YOUR PICKUP CODE
          </span>
          <div className="py-3 px-6 rounded-2xl bg-sand/30 border border-border inline-block mb-3">
            <span className="font-display font-black text-4xl sm:text-5xl text-espresso tracking-widest">
              {code}
            </span>
          </div>
          <p className="text-xs font-bold text-orange flex items-center justify-center gap-1.5">
            Show this at the counter
          </p>
        </div>

        {/* Outlet & Ready Time Info */}
        <div className="bg-sand/40 rounded-2xl border border-border p-4 my-3 space-y-2 max-w-sm mx-auto w-full overflow-hidden">
          <div className="flex items-center gap-2.5 text-xs text-espresso">
            <Store className="w-4 h-4 text-orange shrink-0" />
            <span className="font-bold truncate">{outletName}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-espresso/80">
            <Clock className="w-4 h-4 text-espresso/50 shrink-0" />
            <span className="font-semibold">Ready in 15-20 min</span>
          </div>
        </div>

        {/* Order Summary */}
        {itemsList.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 my-2 max-w-sm mx-auto w-full space-y-2.5 overflow-hidden">
            <span className="text-[10px] font-black uppercase tracking-wider text-espresso/50 block">
              Order Summary
            </span>
            <div className="divide-y divide-border/60">
              {itemsList.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <span className="text-espresso font-medium truncate pr-2">
                    <strong className="text-espresso font-black mr-1">{item.qty || 1}×</strong>
                    {item.name}
                  </span>
                  <span className="font-bold text-espresso shrink-0">
                    {formatPrice(Number(item.price || item.unitPrice || 0) * (item.qty || 1))}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <span className="font-bold text-espresso">Total Paid</span>
              <strong className="font-display font-black text-base text-espresso">
                {formatPrice(order?.total || 0)}
              </strong>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Action */}
      <div className="shrink-0 p-4 bg-cream/95 backdrop-blur-md border-t border-border z-30 pb-[max(16px,env(safe-area-inset-bottom))] w-full">
        <NextLink href="/outlet" className="block w-full">
          <Button className="w-full text-base font-bold shadow-orange group">
            <span>Back to menu</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </NextLink>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-cream flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange" />
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
