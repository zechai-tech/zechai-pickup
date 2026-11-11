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
  Minus,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';
import { getMenu } from '@/lib/api';
import { MenuItem } from '@/types';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { VegBadge } from '@/components/ui/VegBadge';
import { MenuImage } from '@/components/ui/MenuImage';
import { formatPrice } from '@/lib/utils';

const MENU_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'Chai & Coffee', label: 'Chai & Coffee' },
  { id: 'Coolers', label: 'Coolers' },
  { id: 'Chicken', label: 'Chicken' },
  { id: 'Fries', label: 'Fries' },
];

export default function MenuPage() {
  const router = useRouter();
  const { outlet, cart, addItem, updateCartQty } = useZechaStore();
  const { showToast } = useToast();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { count, grandTotal } = getCartSummary(cart);

  useEffect(() => {
    // If no outlet is selected, go back to /outlets
    if (!outlet) {
      router.push('/outlets');
      return;
    }

    getMenu(outlet.id).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [outlet, router]);

  // Compute quantity in cart for an item
  const getItemQty = (itemId: string): number => {
    return cart
      .filter((i) => i.itemId === itemId || i.lineId === itemId)
      .reduce((sum, i) => sum + i.qty, 0);
  };

  const getItemLineId = (itemId: string): string => {
    const found = cart.find((i) => i.itemId === itemId || i.lineId === itemId);
    return found ? found.lineId : itemId;
  };

  const handleAddItem = (item: MenuItem) => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image || item.image_url || '/assets/chai.jpg',
      isVeg: item.isVeg ?? item.is_veg ?? true,
    });
    showToast(`Added ${item.name} to cart`, 'success');
  };

  // Filter items by category & search
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
    } else if (selectedCategory !== 'all') {
      result = result.filter(
        (item) => item.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    return result;
  }, [items, searchQuery, selectedCategory]);

  // Split items into Bestsellers and Popular without repetition
  const { bestsellers, popularItems } = useMemo(() => {
    if (searchQuery.trim()) {
      return { bestsellers: [], popularItems: filteredItems };
    }

    const allBestsellers = filteredItems.filter(
      (item) => item.isBestseller || item.is_bestseller
    );
    // Take top 2 bestsellers for the 2-column grid
    const topBestsellers = allBestsellers.slice(0, 2);
    const bestsellersIds = new Set(topBestsellers.map((b) => b.id));

    // Popular items: remaining items (guaranteed NO duplicates!)
    const remaining = filteredItems.filter((item) => !bestsellersIds.has(item.id));

    return {
      bestsellers: topBestsellers,
      popularItems: remaining,
    };
  }, [filteredItems, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FDFBEA] flex flex-col page-transition relative pb-28 select-none">
      {/* Fixed / Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#FDFBEA]/95 backdrop-blur-md px-4 pt-3 pb-2 border-b border-[#EADFC7]/60">
        <div className="flex items-center justify-between">
          {/* Back button */}
          <Link
            href="/outlets"
            className="w-11 h-11 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC]/50 transition-colors shadow-2xs"
            aria-label="Back to outlets"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>

          {/* Center: PICKUP FROM over outlet name with chevron */}
          <Link
            href="/outlets"
            className="flex flex-col items-center group text-center cursor-pointer max-w-[210px]"
          >
            <span className="text-[11px] font-black tracking-widest uppercase text-[#CE5535]">
              PICKUP FROM
            </span>
            <div className="flex items-center gap-1 text-[15px] font-extrabold text-[#2B1A12] group-hover:text-[#CE5535] transition-colors leading-tight">
              <span className="truncate">{outlet?.name || 'Choose Outlet'}</span>
              <ChevronDown className="w-4 h-4 stroke-[2.8] text-[#2B1A12] shrink-0" />
            </div>
          </Link>

          {/* Right Logo (64px) */}
          <div className="w-[64px] h-[30px] relative">
            <Image
              src="/assets/logo-orange.png"
              alt="Zécha!"
              width={64}
              height={30}
              priority
              className="object-contain object-right"
            />
          </div>
        </div>

        {/* Search Bar (46px tall) */}
        <div className="relative mt-2.5">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#75604F]/60">
            <Search className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chai, chicken, fries…"
            className="w-full h-[46px] pl-11 pr-4 rounded-[14px] bg-[#FFFEF7] border border-[#EADFC7] text-xs font-semibold text-[#2B1A12] placeholder:text-[#75604F]/60 focus:outline-none focus:border-[#CE5535] transition-all"
          />
        </div>

        {/* Category Chips: All, Chai & Coffee, Coolers, Chicken, Fries */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-1 scrollbar-none -mx-4 px-4 overscroll-x-contain touch-scroll">
          {MENU_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`h-8 px-4 rounded-full text-xs font-extrabold whitespace-nowrap transition-all duration-150 active:scale-95 shrink-0 ${
                  isActive
                    ? 'bg-[#2B1A12] text-[#FDFBEA] shadow-xs'
                    : 'bg-[#F4E7CC] text-[#2B1A12] hover:bg-[#EBD8B7]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 pt-3 space-y-6">
        {loading ? (
          <div className="space-y-4 pt-2">
            <div className="h-6 w-32 bg-[#F4E7CC]/50 rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-[210px] bg-[#F4E7CC]/30 rounded-[18px] animate-pulse" />
              <div className="h-[210px] bg-[#F4E7CC]/30 rounded-[18px] animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* FIRST Section: Bestsellers (2-column grid of 158px photo tiles) */}
            {bestsellers.length > 0 && !searchQuery && (
              <div>
                <h2 className="font-display text-[22px] font-extrabold text-[#2B1A12] mb-3 tracking-tight">
                  Bestsellers
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  {bestsellers.map((item, idx) => {
                    const qty = getItemQty(item.id);
                    const lineId = getItemLineId(item.id);

                    return (
                      <div
                        key={item.id}
                        className="bg-[#FFFEF7] rounded-[18px] border border-[#EADFC7] p-2 flex flex-col justify-between shadow-2xs hover:border-[#E3D7BC] transition-all"
                      >
                        {/* 158px tall photo tile with badges & overlapping ADD/stepper button */}
                        <div className="relative w-full h-[158px] rounded-[14px] overflow-visible mb-5">
                          {/* Photo with rounded corners */}
                          <Link
                            href={`/menu/${item.id}`}
                            className="block w-full h-full rounded-[14px] overflow-hidden"
                          >
                            <MenuImage
                              src={item.image || item.image_url || '/assets/chai.jpg'}
                              alt={item.name}
                              fill
                              sizes="(max-width: 430px) 190px, 200px"
                              priority={idx < 2}
                              className="object-cover hover:scale-105 transition-transform duration-300"
                            />
                          </Link>

                          {/* Yellow BESTSELLER badge */}
                          <div className="absolute top-2 left-2 pointer-events-none z-10">
                            <span className="px-2 py-0.5 rounded-[6px] bg-[#E8B125] text-[#2B1A12] text-[10px] font-black uppercase tracking-wider shadow-xs">
                              BESTSELLER
                            </span>
                          </div>

                          {/* IN CART badge if in cart */}
                          {qty > 0 && (
                            <div className="absolute top-2 right-2 pointer-events-none z-10">
                              <span className="px-2 py-0.5 rounded-[6px] bg-[#2B1A12] text-[#FDFBEA] text-[10px] font-black uppercase tracking-wider shadow-xs">
                                IN CART
                              </span>
                            </div>
                          )}

                          {/* White Overlapping ADD button (96x36, 10px radius, overlapping photo bottom) */}
                          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20">
                            {qty === 0 ? (
                              <button
                                onClick={() => handleAddItem(item)}
                                className="w-[96px] h-[36px] rounded-[10px] bg-white border border-[#EADFC7] text-[#CE5535] font-black text-xs tracking-wider shadow-md hover:bg-[#FFFEF7] active:scale-95 transition-all flex items-center justify-center uppercase"
                              >
                                ADD
                              </button>
                            ) : (
                              <div className="w-[96px] h-[36px] rounded-[10px] bg-white border border-[#CE5535] text-[#2B1A12] font-black text-xs shadow-md flex items-center justify-between px-2">
                                <button
                                  onClick={() => updateCartQty(lineId, -1)}
                                  className="w-6 h-6 flex items-center justify-center text-[#CE5535] hover:bg-[#FBEDE3] rounded"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <span className="font-extrabold text-sm">{qty}</span>
                                <button
                                  onClick={() => updateCartQty(lineId, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-[#CE5535] hover:bg-[#FBEDE3] rounded"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Veg/non-veg dot, name, and price underneath */}
                        <Link href={`/menu/${item.id}`} className="block pt-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <VegBadge isVeg={item.isVeg ?? item.is_veg ?? true} size="sm" />
                            <h3 className="font-extrabold text-sm text-[#2B1A12] truncate">
                              {item.name}
                            </h3>
                          </div>
                          <p className="font-extrabold text-[15px] text-[#2B1A12]">
                            {formatPrice(item.price)}
                          </p>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECOND Section: Popular right now (Swiggy-style list of rows) */}
            <div>
              <h2 className="font-display text-[22px] font-extrabold text-[#2B1A12] mb-3 tracking-tight">
                {searchQuery ? 'Search Results' : 'Popular right now'}
              </h2>

              <div className="bg-[#FFFEF7] rounded-[22px] border border-[#EADFC7] divide-y divide-[#EADFC7]/70 overflow-hidden shadow-2xs">
                {popularItems.length === 0 ? (
                  <div className="p-8 text-center text-[#75604F]">
                    <p className="font-bold text-sm">No items found</p>
                  </div>
                ) : (
                  popularItems.map((item) => {
                    const qty = getItemQty(item.id);
                    const lineId = getItemLineId(item.id);
                    const isVeg = item.isVeg ?? item.is_veg ?? true;
                    const isBestseller = item.isBestseller ?? item.is_bestseller ?? false;

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 sm:p-4 flex items-start justify-between gap-3 hover:bg-[#FAF4E6]/30 transition-colors"
                      >
                        {/* Left column: Name, price, description */}
                        <Link
                          href={`/menu/${item.id}`}
                          className="flex-1 min-w-0 pr-1 block"
                        >
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <VegBadge isVeg={isVeg} size="sm" />
                            {isBestseller && (
                              <span className="text-[11px] font-extrabold text-[#CE5535] flex items-center gap-0.5">
                                ★ Bestseller
                              </span>
                            )}
                          </div>

                          <h3 className="font-extrabold text-[16px] text-[#2B1A12] leading-snug">
                            {item.name}
                          </h3>

                          <p className="font-black text-[15px] text-[#2B1A12] mt-0.5 mb-1">
                            {formatPrice(item.price)}
                          </p>

                          {item.description && (
                            <p className="text-[13px] text-[#75604F] leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </Link>

                        {/* Right column: 124px photo with overlapping white ADD/stepper button */}
                        <div className="relative w-[124px] h-[116px] shrink-0 mb-3">
                          <Link
                            href={`/menu/${item.id}`}
                            className="block w-full h-[96px] rounded-[14px] overflow-hidden relative"
                          >
                            <MenuImage
                              src={item.image || item.image_url || '/assets/chai.jpg'}
                              alt={item.name}
                              fill
                              sizes="124px"
                              className="object-cover hover:scale-105 transition-transform duration-300"
                            />
                          </Link>

                          {/* Overlapping ADD / Stepper Button */}
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20">
                            {qty === 0 ? (
                              <div className="flex flex-col items-center">
                                <button
                                  onClick={() => handleAddItem(item)}
                                  className="w-[96px] h-[34px] rounded-[10px] bg-white border border-[#EADFC7] text-[#CE5535] font-black text-xs tracking-wider shadow-md hover:bg-[#FFFEF7] active:scale-95 transition-all flex items-center justify-center uppercase"
                                >
                                  ADD
                                </button>
                                {item.hasCustomization && (
                                  <span className="text-[10px] font-medium text-[#75604F] mt-0.5">
                                    Customisable
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="w-[96px] h-[34px] rounded-[10px] bg-white border border-[#CE5535] text-[#2B1A12] font-black text-xs shadow-md flex items-center justify-between px-2">
                                <button
                                  onClick={() => updateCartQty(lineId, -1)}
                                  className="w-6 h-6 flex items-center justify-center text-[#CE5535] hover:bg-[#FBEDE3] rounded"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <span className="font-extrabold text-sm">{qty}</span>
                                <button
                                  onClick={() => updateCartQty(lineId, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-[#CE5535] hover:bg-[#FBEDE3] rounded"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Sticky Dark Cart Bar (appears ONLY when cart has items) */}
      {count > 0 && (
        <div className="fixed bottom-4 left-0 right-0 max-w-[430px] mx-auto px-4 z-40 pointer-events-auto">
          <Link
            href="/cart"
            prefetch={true}
            className="flex items-center justify-between p-3.5 px-4 rounded-[22px] bg-[#2B1A12] text-[#FDFBEA] shadow-[0_10px_30px_rgba(43,26,18,0.25)] border border-[#2B1A12] active:scale-[0.98] transition-all duration-150 w-full"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#CE5535] flex items-center justify-center shrink-0 shadow-xs">
                <ShoppingBag className="w-5 h-5 text-[#FDFBEA] stroke-[2]" />
              </div>
              <div className="leading-tight">
                <span className="text-xs text-[#FDFBEA]/70 font-semibold block">
                  {count} {count === 1 ? 'item' : 'items'}
                </span>
                <span className="font-extrabold text-[17px] text-[#FDFBEA] tabular-nums">
                  {formatPrice(grandTotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-extrabold text-sm bg-white/10 hover:bg-white/20 py-2 px-4 rounded-full transition-colors">
              <span>View cart</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
