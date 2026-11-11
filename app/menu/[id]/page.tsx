'use client';

import React, { useEffect, useState, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Minus } from 'lucide-react';
import { getMenuItemById } from '@/lib/api';
import { MenuItem } from '@/types';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { VegBadge } from '@/components/ui/VegBadge';
import { MenuImage } from '@/components/ui/MenuImage';
import { formatPrice } from '@/lib/utils';

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { addItem, cart } = useZechaStore();
  const { showToast } = useToast();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    getMenuItemById(id).then((data) => {
      if (data) {
        setItem(data);
      }
      setLoading(false);
    });
  }, [id]);

  const handleAddToCart = () => {
    if (!item) return;

    for (let i = 0; i < qty; i++) {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image || item.image_url || '/assets/chai.jpg',
        isVeg: item.isVeg ?? item.is_veg ?? true,
      });
    }

    showToast('Added to cart', 'success');
    router.push('/menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-[#2B1A12] mb-2">Item not found</h2>
        <Link
          href="/menu"
          className="text-[#CE5535] font-bold text-sm underline"
        >
          Back to menu
        </Link>
      </div>
    );
  }

  const isVeg = item.isVeg ?? item.is_veg ?? true;
  const isBestseller = item.isBestseller ?? item.is_bestseller ?? false;
  const totalPrice = item.price * qty;

  return (
    <div className="min-h-screen bg-[#FDFBEA] flex flex-col justify-between pb-28 page-transition select-none">
      <div>
        {/* Big photo (440px tall, bottom corners 32px rounded) with round back button on it */}
        <div className="relative w-full h-[440px] rounded-b-[32px] overflow-hidden shadow-sm">
          <MenuImage
            src={item.image || item.image_url || '/assets/chai.jpg'}
            alt={item.name}
            fill
            priority
            sizes="(max-width: 430px) 100vw, 430px"
            className="object-cover"
          />

          {/* Round cream back button (44px) positioned over photo */}
          <Link
            href="/menu"
            className="absolute top-5 left-5 z-20 w-11 h-11 rounded-full bg-[#FFFEF7]/95 border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC] transition-colors shadow-md backdrop-blur-xs"
            aria-label="Back to menu"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>
        </div>

        {/* Content area below photo */}
        <div className="p-5 pt-6 space-y-3">
          {/* Veg/non-veg dot + optional BESTSELLER badge */}
          <div className="flex items-center gap-2">
            <VegBadge isVeg={isVeg} size="sm" />
            {isBestseller && (
              <span className="px-2.5 py-0.5 rounded-[6px] bg-[#E8B125] text-[#2B1A12] text-[11px] font-black uppercase tracking-wider shadow-xs">
                BESTSELLER
              </span>
            )}
          </div>

          {/* Name (30px, 800) with price on the right (22px, 800) */}
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-display text-[30px] font-extrabold text-[#2B1A12] leading-tight">
              {item.name}
            </h1>
            <span className="font-display text-[22px] font-extrabold text-[#2B1A12] shrink-0">
              {formatPrice(item.price)}
            </span>
          </div>

          {/* Description (15px, muted #75604F) */}
          {item.description && (
            <p className="text-[15px] text-[#75604F] leading-relaxed font-medium">
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar: Quantity stepper pill + "Add to cart · ₹<qty x price>" */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto p-4 bg-[#FDFBEA]/95 backdrop-blur-md border-t border-[#EADFC7]/80 z-30 flex items-center gap-3">
        {/* Quantity Stepper Pill */}
        <div className="h-[56px] px-3.5 rounded-[20px] bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-between gap-3 shadow-xs">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC] active:scale-95 transition-all"
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4 stroke-[2.5]" />
          </button>
          <span className="font-extrabold text-base text-[#2B1A12] w-4 text-center">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC] active:scale-95 transition-all"
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Primary Add to Cart CTA */}
        <button
          onClick={handleAddToCart}
          className="flex-1 h-[56px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[16px] flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-all"
        >
          <span>Add to cart · {formatPrice(totalPrice)}</span>
        </button>
      </div>
    </div>
  );
}
