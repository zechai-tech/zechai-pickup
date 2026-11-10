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
import { cn, formatPrice } from '@/lib/utils';

export default function MenuPage() {
  const router = useRouter();
  const { outlet, cart, addItem, updateCartQty } = useZechaStore();
  const { showToast } = useToast();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

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

  // Compute quantity in cart for an itemId
  const getItemQtyInCart = (itemId: string): number => {
    return cart
      .filter((i) => i.itemId === itemId || i.lineId === itemId)
      .reduce((sum, i) => sum + i.qty, 0);
  };

  const getItemLineId = (itemId: string): string | undefined => {
    const item = cart.find((i) => i.itemId === itemId || i.lineId === itemId);
    return item?.lineId;
  };

  const handleAddToCart = (item: MenuItem) => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      isVeg: item.isVeg,
    });
    showToast(`Added ${item.name} to cart`, 'success');
  };

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('All');
    items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [items]);

  // Filter items by search query and category
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q))
      );
    } else if (selectedCategory !== 'All') {
      result = result.filter(
        (item) => item.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    return result;
  }, [items, searchQuery, selectedCategory]);

  // Bestsellers list
  const bestsellers = useMemo(() => {
    return items.filter((item) => item.is_bestseller || item.isBestseller);
  }, [items]);

  return (
    <div className="flex-1 flex flex-col h-full bg-cream page-transition overflow-hidden relative">
      {/* Top App Header (Fixed at top of screen) */}
      <div className="shrink-0 z-30 bg-cream/95 backdrop-blur-md px-4 pt-3 pb-2 border-b border-border/50">
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
              <span className="truncate max-w-[200px]">{outlet?.name || 'Zécha! Thamarassery'}</span>
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

        {/* Category Horizontal Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-1 scrollbar-none -mx-4 px-4">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'h-8 px-3.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-95 flex-shrink-0',
                  isActive
                    ? 'bg-espresso text-cream shadow-sm'
                    : 'bg-sand text-espresso hover:bg-[#ebd8b7]'
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-24 space-y-5 scrollbar-none">
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
            {/* Bestsellers Section (horizontally scrollable cards per Change 3) */}
            {!searchQuery && bestsellers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-lg font-black text-espresso">
                    Bestsellers
                  </h2>
                  <span className="text-[11px] font-bold text-espresso/50 uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-none">
                  {bestsellers.map((item) => {
                    const qtyInCart = getItemQtyInCart(item.id);

                    return (
                      <div
                        key={item.id}
                        className="w-[160px] flex-shrink-0 snap-start bg-card rounded-card border border-border overflow-hidden flex flex-col justify-between p-2.5 shadow-sm hover:border-orange/40 transition-all"
                      >
                        {/* Image container with Badge */}
                        <div className="relative w-full h-24 rounded-xl overflow-hidden bg-sand/40">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                          {/* Badge */}
                          <div className="absolute top-2 left-2">
                            {qtyInCart > 0 ? (
                              <span className="bg-espresso text-cream text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                                IN CART
                              </span>
                            ) : (
                              <span className="bg-mustard text-espresso text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
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

                            {/* Direct Add Button */}
                            <button
                              onClick={() => handleAddToCart(item)}
                              className="w-7 h-7 rounded-full bg-orange text-cream flex items-center justify-center hover:bg-orange-dark active:scale-90 transition-all shadow-orange-sm"
                              aria-label={`Add ${item.name}`}
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category Items List */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="font-display text-lg font-black text-espresso">
                  {searchQuery ? `Results for "${searchQuery}"` : selectedCategory}
                </h2>
                <span className="text-xs text-espresso/60 font-semibold">
                  {filteredItems.length} items
                </span>
              </div>

              {filteredItems.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-8 text-center">
                  <p className="text-xs text-espresso/60 font-semibold">
                    No items available in this category.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredItems.map((item) => {
                    const qtyInCart = getItemQtyInCart(item.id);
                    const lineId = getItemLineId(item.id);

                    return (
                      <div
                        key={item.id}
                        className="bg-card rounded-card border border-border p-3 flex items-center justify-between gap-3 shadow-xs hover:border-orange/30 transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-sand/40 flex-shrink-0">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <VegBadge isVeg={item.isVeg} size="sm" />
                            <h3 className="font-bold text-sm text-espresso truncate">
                              {item.name}
                            </h3>
                          </div>
                          {item.description && (
                            <p className="text-xs text-espresso/60 line-clamp-1 mb-1 font-normal">
                              {item.description}
                            </p>
                          )}
                          <span className="font-extrabold text-[14px] text-espresso">
                            {formatPrice(item.price)}
                          </span>
                        </div>

                        {/* Action: ADD or Stepper */}
                        <div className="flex-shrink-0">
                          {qtyInCart > 0 && lineId ? (
                            <Stepper
                              size="sm"
                              value={qtyInCart}
                              onIncrement={() => updateCartQty(lineId, 1)}
                              onDecrement={() => updateCartQty(lineId, -1)}
                            />
                          ) : (
                            <button
                              onClick={() => handleAddToCart(item)}
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
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Bottom Cart Bar */}
      <CartFloatingBar />
    </div>
  );
}
