'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { getCustomerStageState } from '@/lib/order-flow';

export function ActiveOrderBanner() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const checkActiveOrder = useCallback(async () => {
    try {
      const storedId = sessionStorage.getItem('activeOrderId');
      const storedCode = sessionStorage.getItem('activeOrderCode');
      const storedTime = sessionStorage.getItem('activeOrderTime');

      if (!storedId && !storedCode) {
        setActiveCode(null);
        return;
      }

      // Check if within last 2 hours (2 * 60 * 60 * 1000 = 7,200,000 ms)
      if (storedTime) {
        const age = Date.now() - parseInt(storedTime, 10);
        if (age > 7200000) {
          sessionStorage.removeItem('activeOrderId');
          sessionStorage.removeItem('activeOrderCode');
          sessionStorage.removeItem('activeOrderTime');
          setActiveCode(null);
          return;
        }
      }

      const param = storedId
        ? `id=${encodeURIComponent(storedId)}`
        : `code=${encodeURIComponent(storedCode!)}`;

      const res = await fetch(`/api/orders/track?${param}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          setActiveCode(null);
        }
        return;
      }

      const data = await res.json();
      const order = data?.order;

      if (order) {
        const stageProgress = getCustomerStageState(order.status);
        if (
          ['pending', 'preparing', 'packaging', 'ready'].includes(stageProgress.canonicalStatus)
        ) {
          setActiveId(order.id);
          setActiveCode(order.pickup_code);
          setActiveStatus(stageProgress.bannerStatusText);
        } else {
          setActiveCode(null);
        }
      } else {
        setActiveCode(null);
      }
    } catch (err) {
      console.warn('Active order check notice:', err);
    }
  }, []);

  useEffect(() => {
    checkActiveOrder();

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(checkActiveOrder, 4000);
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
        checkActiveOrder();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkActiveOrder]);

  if (!activeCode) return null;

  return (
    <div className="shrink-0 w-full bg-[#CE5535] text-white px-4 py-2.5 flex items-center justify-between text-xs shadow-md z-30 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-3 h-3 text-[#FDFBEA]" />
        </div>
        <span className="font-semibold truncate">
          Active order <strong className="font-black">#{activeCode}</strong>{' '}
          {activeStatus}
        </span>
      </div>

      <Link
        href={activeId ? `/track-order?id=${encodeURIComponent(activeId)}` : `/track-order?code=${activeCode}`}
        className="shrink-0 ml-2 px-3 py-1 rounded-full bg-white text-[#CE5535] font-black text-[11px] hover:bg-[#FDFBEA] active:scale-95 transition-all flex items-center gap-1 shadow-xs"
      >
        <span>Track</span>
        <ArrowRight className="w-3 h-3 stroke-[2.5]" />
      </Link>
    </div>
  );
}
