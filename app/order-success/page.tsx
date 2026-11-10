'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, ArrowRight, Store, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const [code, setCode] = React.useState(searchParams.get('code') || '');
  const [outlet, setOutlet] = React.useState(searchParams.get('outlet') || 'Zécha! Thamarassery');
  const [total, setTotal] = React.useState(searchParams.get('total') || '');

  React.useEffect(() => {
    const paramCode = searchParams.get('code');
    const paramOutlet = searchParams.get('outlet');
    const paramTotal = searchParams.get('total');

    if (paramCode) {
      setCode(paramCode);
      if (paramOutlet) setOutlet(paramOutlet);
      if (paramTotal) setTotal(paramTotal);
      return;
    }

    // Check sessionStorage
    const pending = sessionStorage.getItem('pendingOrder');
    if (pending) {
      try {
        const parsed = JSON.parse(pending);
        if (parsed.pickupCode) setCode(parsed.pickupCode);
        if (parsed.outletName) setOutlet(parsed.outletName);
        if (parsed.total) setTotal(parsed.total.toString());
        return;
      } catch (e) {}
    }

    // Check localStorage
    const storedCode = localStorage.getItem('activeOrderCode');
    const storedOutlet = localStorage.getItem('activeOrderOutlet');
    if (storedCode) setCode(storedCode);
    if (storedOutlet) setOutlet(storedOutlet);
  }, [searchParams]);

  const displayCode = code || '----';

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
            <span className="truncate">{outlet}</span>
          </div>
          {total && (
            <p className="text-sm font-extrabold text-[#2B1A12]">
              Total paid: ₹{total}
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
        <Link href={`/track-order?code=${displayCode}`} className="block w-full">
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
