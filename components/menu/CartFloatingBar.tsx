'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { formatPrice } from '@/lib/utils';

export function CartFloatingBar() {
  const { cart } = useZechaStore();
  const { count, grandTotal } = getCartSummary(cart);

  if (count === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-40 safe-bottom">
      <Link
        href="/cart"
        className="flex items-center justify-between p-3 px-4 rounded-[22px] bg-espresso text-cream shadow-float border border-espresso/20 active:scale-[0.98] transition-all duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange flex items-center justify-center flex-shrink-0 shadow-sm">
            <ShoppingBag className="w-5 h-5 text-cream stroke-[2]" />
          </div>
          <div className="font-extrabold text-sm text-cream tabular-nums">
            {count} {count === 1 ? 'item' : 'items'} · {formatPrice(grandTotal)}
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-bold text-xs bg-cream/15 hover:bg-cream/25 py-2.5 px-4 rounded-full text-cream transition-colors">
          <span>View cart</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </Link>
    </div>
  );
}
