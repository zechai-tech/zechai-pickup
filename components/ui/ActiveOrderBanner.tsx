'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ActiveOrderBanner() {
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  useEffect(() => {
    const checkActiveOrder = async () => {
      try {
        const storedCode =
          localStorage.getItem('activeOrderCode') ||
          sessionStorage.getItem('activeOrderCode');
        const storedTime =
          localStorage.getItem('activeOrderTime') ||
          sessionStorage.getItem('activeOrderTime');

        if (!storedCode) return;

        // Check if within last 2 hours (2 * 60 * 60 * 1000 = 7,200,000 ms)
        if (storedTime) {
          const age = Date.now() - parseInt(storedTime, 10);
          if (age > 7200000) {
            localStorage.removeItem('activeOrderCode');
            localStorage.removeItem('activeOrderTime');
            sessionStorage.removeItem('activeOrderCode');
            sessionStorage.removeItem('activeOrderTime');
            return;
          }
        }

        // Query Supabase for latest status
        const { data: order } = await (supabase.from('orders') as any)
          .select('pickup_code, status, created_at')
          .eq('pickup_code', storedCode)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (order && ['confirmed', 'preparing', 'ready'].includes(order.status)) {
          setActiveCode(order.pickup_code);
          setActiveStatus(order.status);
        } else {
          setActiveCode(null);
        }
      } catch (err) {
        console.warn('Active order check notice:', err);
      }
    };

    checkActiveOrder();
    const interval = setInterval(checkActiveOrder, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!activeCode) return null;

  return (
    <div className="shrink-0 w-full bg-[#CE5535] text-white px-4 py-2.5 flex items-center justify-between text-xs shadow-md z-30 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-3 h-3 text-[#FDFBEA]" />
        </div>
        <span className="font-semibold truncate">
          Active order <strong className="font-black">#{activeCode}</strong>
          {activeStatus === 'ready'
            ? ' is ready!'
            : activeStatus === 'preparing'
            ? ' is being prepared'
            : ' is confirmed'}
        </span>
      </div>

      <Link
        href={`/track-order?code=${activeCode}`}
        className="shrink-0 ml-2 px-3 py-1 rounded-full bg-white text-[#CE5535] font-black text-[11px] hover:bg-[#FDFBEA] active:scale-95 transition-all flex items-center gap-1 shadow-xs"
      >
        <span>Track</span>
        <ArrowRight className="w-3 h-3 stroke-[2.5]" />
      </Link>
    </div>
  );
}
