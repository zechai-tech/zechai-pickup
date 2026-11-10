'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronDown,
  Search,
  Plus,
} from 'lucide-react';
import { getMenu } from '@/lib/api';
import { MenuItem } from '@/types';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { VegBadge } from '@/components/ui/VegBadge';
import { Stepper } from '@/components/ui/Stepper';
import { CartFloatingBar } from '@/components/menu/CartFloatingBar';
import { CATEGORIES } from '@/lib/mock-data';
import { cn, formatPrice } from '@/lib/utils';

export default function MenuPage() {
  const router = useRouter();
  const { outlet, cart, addToCart, updateCartQty } = useZechaStore();
  const { showToast } = useToast();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('chai_coffee');

  useEffect(() => {
    // If no outlet selected, redirect to /outlet
    if (!outlet) {
      router.push('/outlet');
      return;
    }

    getMenu(outlet.id).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [outlet, router]);

  // Compute quantity in cart for a base itemId
  const getItemQtyInCart = (itemId: string): number => {
    return cart
      .filter((i) => i.itemId === itemId)
      .reduce((sum, i) => sum + i.qty, 0);
  };

  const getItemLineId = (itemId: string): string | undefined => {
    const item = cart.find((i) => i.itemId === itemId);
    return item?.lineId;
  };

  const handleSimpleAdd = (item: MenuItem) => {
    addToCart({
      lineId: `${item.id}-default`,
      itemId: item.id,
      name: item.name,
      image: item.image,
      isVeg: item.isVeg,
      unitPrice: item.price,
      qty: 1,
    });
    showToast(`Added ${item.name} to cart`, 'success');
  };

  // Filter items by search query and category
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, searchQuery]);

  const bestsellers = useMemo(() => {
    return items.filter((item) => item.isBestseller);
  }, [items]);

  return (
    <div className="min-h-[100dvh] h-full flex flex-col bg-cream page-transition overflow-hidden relative w-full max-w-full">
      {/* Top App Header (Fixed / Sticky at top) */}
      <header className="shrink-0 z-30 bg-cream/95 backdrop-blur-md px-4 pt-3 pb-2 border-b border-border/50 sticky top-0 w-full">
        <div className="flex items-center justify-between">
          {/* Back button */}
          <Link
            href="/outlet"
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-espresso hover:bg-sand/40 transition-colors"
            aria-label="Back to outlet selection"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </Link>

          {/* Center Outlet Selector */}
          <Link
            href="/outlet"
            className="flex flex-col items-center group text-center cursor-pointer"
          >
            <span className="text-[10px] font-black tracking-widest uppercase text-orange">
              PICKUP FROM
            </span>
            <div className="flex items-center gap-1 text-[15px] font-extrabold text-espresso group-hover:text-orange transition-colors">
              <span className="truncate max-w-[200px]">{outlet?.name || 'Select Outlet'}</span>
              <ChevronDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </Link>

          {/* Right Mascot Cup Icon */}
          <div className="w-10 h-10 rounded-full bg-sand/60 border border-border flex items-center justify-center">
            <Image
              src="/assets/mascot-orange.png"
              alt="Mascot"
              width={22}
              height={22}
              className="object-contain"
            />
          </div>
        </div>

        {/* Search Box */}
        <div className="relative mt-2.5">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-espresso/50 stroke-[2]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chai, chicken, fries..."
            className="w-full h-10 pl-10 pr-4 rounded-full bg-card border border-border text-xs font-semibold text-espresso placeholder:text-espresso/45 focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange transition-all"
          />
        </div>

        {/* Category Horizontal Chips (Independently scrollable without chaining) */}
        <div
          className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-1 scrollbar-none -mx-4 px-4 overscroll-x-contain touch-scroll"
          style={{ overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'h-8 px-3.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-95 flex-shrink-0',
                  isActive
                    ? 'bg-espresso text-cream shadow-sm'
                    : 'bg-sand text-espresso hover:bg-[#ebd8b7]'
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden px-4 pt-3 pb-32 space-y-5 scrollbar-none touch-scroll w-full max-w-full">
        {loading ? (
          <div className="space-y-4 pt-2">
            <div className="h-6 w-32 bg-sand/50 rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-44 bg-sand/30 rounded-card animate-pulse" />
              <div className="h-44 bg-sand/30 rounded-card animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* Bestsellers Section (visible when not actively searching) */}
            {!searchQuery && (
              <div>
                <h2 className="font-display text-lg font-black text-espresso mb-2.5">
                  Bestsellers
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  {bestsellers.slice(0, 2).map((item) => {
                    const qtyInCart = getItemQtyInCart(item.id);
                    const lineId = getItemLineId(item.id);

                    return (
                      <div
                        key={item.id}
                        className="bg-card rounded-card border border-border overflow-hidden flex flex-col justify-between p-2.5 shadow-sm hover:border-orange/40 transition-all"
                      >
                        {/* Image container with Badge */}
                        <div className="relative w-full h-24 rounded-xl overflow-hidden bg-sand/40">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="160px"
                            loading="lazy"
                            className="object-cover"
                          />
                          {/* Badge */}
                          <div className="absolute top-2 left-2">
                            {qtyInCart > 0 ? (
                              <span className="bg-espresso text-cream text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                                IN CART
                              </span>
                            ) : (
                              <span className="bg-mustard text-espresso text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                                BESTSELLER
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Price */}
                        <div className="pt-2 pb-0.5 flex-1 flex flex-col justify-between">
                          <h3 className="font-bold text-xs text-espresso leading-snug line-clamp-1">
                            {item.name}
                          </h3>

                          <div className="flex items-center justify-between mt-2 pt-1">
                            <span className="font-extrabold text-[14px] text-espresso">
                              {formatPrice(item.price)}
                            </span>

                            {/* Add button or Stepper */}
                            {item.hasCustomization ? (
                              <button
                                onClick={() => router.push(`/item/${item.id}`)}
                                className="w-7 h-7 rounded-full bg-orange text-cream flex items-center justify-center hover:bg-orange-dark active:scale-90 transition-all shadow-orange-sm"
                                aria-label={`Customise ${item.name}`}
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            ) : qtyInCart > 0 && lineId ? (
                              <Stepper
                                size="sm"
                                value={qtyInCart}
                                onIncrement={() => updateCartQty(lineId, 1)}
                                onDecrement={() => updateCartQty(lineId, -1)}
                              />
                            ) : (
                              <button
                                onClick={() => handleSimpleAdd(item)}
                                className="w-7 h-7 rounded-full bg-orange text-cream flex items-center justify-center hover:bg-orange-dark active:scale-90 transition-all shadow-orange-sm"
                                aria-label={`Add ${item.name}`}
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main Menu List Grouped by Selected Category */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="font-display text-lg font-black text-espresso">
                  {searchQuery
                    ? `Results (${filteredItems.length})`
                    : CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'All Items'}
                </h2>
              </div>

              <div className="space-y-2.5">
                {filteredItems
                  .filter((item) => searchQuery || item.category === selectedCategory)
                  .map((item) => {
                    const qtyInCart = getItemQtyInCart(item.id);
                    const lineId = getItemLineId(item.id);

                    return (
                      <div
                        key={item.id}
                        className="bg-card rounded-card border border-border p-3 flex items-center justify-between gap-3 shadow-xs hover:border-orange/30 transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-sand/40 flex-shrink-0">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="64px"
                            loading="lazy"
                            className="object-cover"
                          />
                        </div>

                        {/* Middle info */}
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <VegBadge isVeg={item.isVeg} size="sm" />
                            <h3 className="font-bold text-xs text-espresso truncate">
                              {item.name}
                            </h3>
                          </div>
                          <p className="text-[11px] text-espresso/60 font-medium line-clamp-1 mb-1">
                            {item.description}
                          </p>
                          <span className="font-extrabold text-[14px] text-espresso">
                            {formatPrice(item.price)}
                          </span>
                        </div>

                        {/* Action: ADD or Stepper */}
                        <div className="flex-shrink-0">
                          {item.hasCustomization ? (
                            <button
                              onClick={() => router.push(`/item/${item.id}`)}
                              className="px-3.5 py-1.5 rounded-full border border-border bg-sand/60 hover:bg-sand text-xs font-black text-orange active:scale-95 transition-all shadow-xs"
                            >
                              ADD
                            </button>
                          ) : qtyInCart > 0 && lineId ? (
                            <Stepper
                              size="sm"
                              value={qtyInCart}
                              onIncrement={() => updateCartQty(lineId, 1)}
                              onDecrement={() => updateCartQty(lineId, -1)}
                            />
                          ) : (
                            <button
                              onClick={() => handleSimpleAdd(item)}
                              className="px-3.5 py-1.5 rounded-full border border-border bg-sand/60 hover:bg-sand text-xs font-black text-orange active:scale-95 transition-all shadow-xs"
                            >
                              ADD
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      <CartFloatingBar />
    </div>
  );
}
