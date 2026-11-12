'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { formatPrice } from '@/lib/utils';

export function CartFloatingBar() {
  const { cart } = useZechaStore();
  const { count, toPay } = getCartSummary(cart);

  if (count === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-40 pb-[max(0px,env(safe-area-inset-bottom))] pointer-events-auto">
      <Link
        href="/cart"
        className="flex items-center justify-between p-3 px-4 rounded-[22px] bg-espresso text-cream shadow-float border border-espresso/20 active:scale-[0.98] transition-all duration-150 w-full"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#CE5535] flex items-center justify-center flex-shrink-0 shadow-sm">
            <ShoppingBag className="w-5 h-5 text-cream stroke-[2]" />
          </div>
          <div>
            <span className="text-xs text-cream/70 font-medium block">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
            <span className="font-extrabold text-[17px] text-cream tabular-nums">
              {formatPrice(toPay)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-bold text-sm bg-cream/10 hover:bg-cream/20 py-2.5 px-4 rounded-full transition-colors">
          <span>View cart</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </Link>
    </div>
  );
}
