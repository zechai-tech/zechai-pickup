'use client';

import React, { Suspense, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronDown,
  Search,
  X,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getOutletMenuData, getOutlets } from '@/lib/api';
import { MenuCategoryDef } from '@/lib/menu-categories';
import { MenuItem, MenuTheme, Outlet } from '@/types';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { VegBadge } from '@/components/ui/VegBadge';
import { SafeImage } from '@/components/ui/SafeImage';
import { DEFAULT_MENU_IMAGE } from '@/lib/images';
import { formatPrice } from '@/lib/utils';

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlOutletId = (searchParams.get('outlet') || '').trim();
  const previewThemeParam = searchParams.get('preview_theme');
  const isPreviewMode = searchParams.get('preview') === '1';

  const { outlet, setOutlet, cart, addItem, updateCartQty, clearCart } = useZechaStore();
  const { showToast } = useToast();

  const [menuTheme, setMenuTheme] = useState<MenuTheme>('classic');
  const [categories, setCategories] = useState<MenuCategoryDef[]>([]);
  const [bestsellers, setBestsellers] = useState<MenuItem[]>([]);
  const [bestsellerIds, setBestsellerIds] = useState<string[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewOutletName, setPreviewOutletName] = useState<string>('');

  // Grid theme item detail bottom sheet
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const sheetTouchStartY = useRef<number | null>(null);
  const [sheetDragY, setSheetDragY] = useState(0);

  // Top outlet switcher dropdown state
  const [availableOutlets, setAvailableOutlets] = useState<Outlet[]>([]);
  const [isOutletMenuOpen, setIsOutletMenuOpen] = useState(false);
  const [pendingSwitchOutlet, setPendingSwitchOutlet] = useState<Outlet | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  const activeOutletId = urlOutletId || outlet?.id || '';
  const effectiveTheme: MenuTheme =
    previewThemeParam === 'grid' || previewThemeParam === 'classic'
      ? previewThemeParam
      : menuTheme;

  const { count, toPay } = getCartSummary(cart);

  // Guard: if no outlet selected (and not previewing an outlet), send user to /outlets
  useEffect(() => {
    if (!activeOutletId) {
      router.push('/outlets');
    }
  }, [activeOutletId, router]);

  // Load outlet name when opened via ?outlet=... in preview mode
  useEffect(() => {
    if (!urlOutletId) return;
    getOutlets().then((list) => {
      const matched = list.find((o) => o.id === urlOutletId);
      if (matched) setPreviewOutletName(matched.name);
    });
  }, [urlOutletId]);

  // Lock background scroll when Grid item bottom sheet is open
  useEffect(() => {
    if (detailItem) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [detailItem]);

  // Load menu + per-outlet bestsellers + menu_theme from no-store server route
  const fetchMenuData = useCallback(
    async (targetOutletId: string, isBackground = false) => {
      if (!targetOutletId) return;
      if (!isBackground) setLoading(true);
      try {
        const data = await getOutletMenuData(targetOutletId);
        setMenuTheme(data.menu_theme === 'grid' ? 'grid' : 'classic');
        setCategories(data.categories);
        setBestsellers(data.bestsellers);
        setBestsellerIds(data.bestseller_ids);
        setItems(data.items);

        setSelectedCategory((curr) => {
          if (curr === 'all') return 'all';
          return data.categories.some((c) => c.name === curr) ? curr : 'all';
        });
      } catch (err) {
        console.error('Menu fetch failed:', err);
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    []
  );

  // Refetch on mount / outlet switch, focus, visibilitychange, and every 15s
  useEffect(() => {
    if (!activeOutletId) return;
    fetchMenuData(activeOutletId, false);

    const onFocus = () => fetchMenuData(activeOutletId, true);
    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchMenuData(activeOutletId, true);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = setInterval(() => {
      fetchMenuData(activeOutletId, true);
    }, 15000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [activeOutletId, fetchMenuData]);

  // Close outlet switcher dropdown when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOutletMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleToggleOutletDropdown = async () => {
    const nextOpen = !isOutletMenuOpen;
    setIsOutletMenuOpen(nextOpen);
    if (nextOpen) {
      try {
        const list = await getOutlets();
        setAvailableOutlets(list);
      } catch {
        setAvailableOutlets([]);
      }
    }
  };

  const handleSelectOutletFromDropdown = (nextOutlet: Outlet) => {
    setIsOutletMenuOpen(false);
    if (!nextOutlet.isOpen) {
      showToast(`${nextOutlet.name} is currently closed`, 'info');
      return;
    }
    if (outlet && nextOutlet.id === outlet.id) return;

    if (cart.length > 0) {
      setPendingSwitchOutlet(nextOutlet);
      return;
    }

    setSearchQuery('');
    setSelectedCategory('all');
    setOutlet(nextOutlet);
  };

  const handleConfirmSwitchOutlet = () => {
    if (!pendingSwitchOutlet) return;
    clearCart();
    setSearchQuery('');
    setSelectedCategory('all');
    setOutlet(pendingSwitchOutlet);
    setPendingSwitchOutlet(null);
    showToast('Switched outlet. Cart was cleared.', 'info');
  };

  const handleSelectCategory = (catName: string) => {
    setSelectedCategory(catName);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const bestsellerSet = useMemo(() => new Set(bestsellerIds), [bestsellerIds]);

  const getItemQty = (itemId: string): number =>
    cart
      .filter((i) => i.itemId === itemId || i.lineId === itemId)
      .reduce((sum, i) => sum + i.qty, 0);

  const getItemLineId = (itemId: string): string => {
    const found = cart.find((i) => i.itemId === itemId || i.lineId === itemId);
    return found ? found.lineId : itemId;
  };

  const handleAddItem = (item: MenuItem) => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image || item.image_url || DEFAULT_MENU_IMAGE,
      isVeg: item.isVeg ?? item.is_veg ?? true,
    });
    showToast(`Added ${item.name} to cart`, 'success');
  };

  // Search matches across ALL categories (ignores chip selection while typing)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Group items under categories in exact sort_order (1..12)
  const groupedSections = useMemo(() => {
    const byCategory = new Map<string, MenuItem[]>();
    for (const item of items) {
      if (!item.category) continue;
      const list = byCategory.get(item.category) || [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const activeCategories =
      selectedCategory === 'all'
        ? categories
        : categories.filter((c) => c.name === selectedCategory);

    return activeCategories
      .map((cat) => ({
        category: cat,
        items: byCategory.get(cat.name) || [],
      }))
      .filter((sec) => sec.items.length > 0);
  }, [categories, items, selectedCategory]);

  const isSearching = searchQuery.trim().length > 0;
  const showBestsellersCarousel =
    !isSearching && selectedCategory === 'all' && bestsellers.length > 0;

  const renderMenuRow = (item: MenuItem, isPriority: boolean) => {
    const qty = getItemQty(item.id);
    const lineId = getItemLineId(item.id);
    const isVeg = item.isVeg ?? item.is_veg ?? true;
    const isBestseller = bestsellerSet.has(item.id);

    return (
      <div
        key={item.id}
        className="p-3.5 sm:p-4 flex items-start justify-between gap-3 hover:bg-[#FAF4E6]/30 transition-colors"
      >
        {/* Left column: Name, price, description */}
        <Link href={`/menu/${item.id}`} className="flex-1 min-w-0 pr-1 block">
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
            <SafeImage
              src={item.image || item.image_url || DEFAULT_MENU_IMAGE}
              alt={item.name}
              variant="thumb"
              fill
              sizes="124px"
              priority={isPriority}
              preloadNearViewport={!isPriority}
              className="object-cover"
            />
          </Link>

          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20">
            {qty === 0 ? (
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleAddItem(item)}
                  className="w-[96px] h-[34px] rounded-[10px] bg-white border border-[#EADFC7] text-[#CE5535] font-black text-xs tracking-wider shadow-md hover:bg-[#FFFEF7] active:scale-95 transition-transform duration-150 flex items-center justify-center uppercase"
                >
                  ADD
                </button>
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
  };

  const renderGridCard = (item: MenuItem, isPriority: boolean, isCarousel = false) => {
    const qty = getItemQty(item.id);
    const lineId = getItemLineId(item.id);
    const isVeg = item.isVeg ?? item.is_veg ?? true;

    return (
      <div
        key={item.id}
        data-testid={isCarousel ? `grid-bestseller-card-${item.id}` : `grid-item-card-${item.id}`}
        className={
          isCarousel
            ? 'w-[46%] shrink-0 snap-start bg-white rounded-[22px] border border-[#EADFC7]/80 p-2 flex flex-col justify-between shadow-2xs'
            : 'bg-white rounded-[22px] border border-[#EADFC7]/80 p-2 flex flex-col justify-between shadow-2xs'
        }
      >
        <div>
          {/* Photo only — no text or badge on the photo; tapping opens bottom sheet */}
          <button
            type="button"
            onClick={() => {
              setSheetDragY(0);
              setDetailItem(item);
            }}
            className="block w-full aspect-[4/5] rounded-[20px] overflow-hidden relative bg-[#FAF4E6] focus:outline-none"
            aria-label={`View details for ${item.name}`}
          >
            <SafeImage
              src={item.image || item.image_url || DEFAULT_MENU_IMAGE}
              alt={item.name}
              variant="tile"
              fill
              sizes="(max-width: 430px) 46vw, 198px"
              priority={isPriority}
              preloadNearViewport={!isPriority}
              className="object-cover"
            />
          </button>

          {/* Veg mark + Item name (regular weight, max 2 lines, no description) */}
          <div className="mt-2 px-0.5 flex items-start gap-1.5">
            <div className="pt-0.5 shrink-0">
              <VegBadge isVeg={isVeg} size="sm" />
            </div>
            <h3 className="font-normal text-[14px] text-[#2B1A12] leading-snug line-clamp-2">
              {item.name}
            </h3>
          </div>
        </div>

        {/* Price inside yellow slanted highlighter tag + ADD / stepper */}
        <div className="mt-2.5 px-0.5 flex items-center justify-between gap-2">
          <span
            className="inline-block bg-[#FFD23F] text-[#2B1A12] font-extrabold text-[13px] px-2 py-0.5 rounded-[5px] tabular-nums shrink-0"
            style={{ transform: 'skewX(-8deg)' }}
          >
            <span className="inline-block" style={{ transform: 'skewX(8deg)' }}>
              {formatPrice(item.price)}
            </span>
          </span>

          {qty === 0 ? (
            <button
              type="button"
              onClick={() => handleAddItem(item)}
              className="h-[32px] px-3.5 rounded-[10px] bg-white border border-[#EADFC7] text-[#CE5535] font-black text-xs tracking-wider shadow-2xs hover:bg-[#FFFEF7] active:scale-95 transition-transform duration-150 flex items-center justify-center uppercase"
            >
              ADD
            </button>
          ) : (
            <div className="h-[32px] min-w-[82px] rounded-[10px] bg-white border border-[#CE5535] text-[#2B1A12] font-black text-xs shadow-2xs flex items-center justify-between px-1.5">
              <button
                type="button"
                onClick={() => updateCartQty(lineId, -1)}
                className="w-6 h-6 flex items-center justify-center text-[#CE5535] hover:bg-[#FBEDE3] rounded"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
              <span className="font-extrabold text-xs px-1">{qty}</span>
              <button
                type="button"
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
    );
  };

  return (
    <div
      data-testid="customer-menu-page"
      data-menu-theme={effectiveTheme}
      className="min-h-screen bg-white flex flex-col page-transition relative pb-28 select-none"
    >
      {/* Sticky Header (white background in both themes) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-3 pb-2 border-b border-[#EADFC7]/60">
        <div className="flex items-center justify-between relative" ref={dropdownRef}>
          {/* Back button */}
          <Link
            href="/outlets"
            className="w-11 h-11 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC]/50 transition-colors shadow-2xs"
            aria-label="Back to outlets"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>

          {/* Center: PICKUP FROM outlet switcher */}
          <button
            type="button"
            onClick={handleToggleOutletDropdown}
            className="flex flex-col items-center group text-center cursor-pointer max-w-[210px] py-1 px-2 rounded-xl hover:bg-[#F4E7CC]/40 transition-colors"
            aria-expanded={isOutletMenuOpen}
            aria-label="Switch outlet"
          >
            <span className="text-[11px] font-black tracking-widest uppercase text-[#CE5535]">
              PICKUP FROM
            </span>
            <div className="flex items-center gap-1 text-[15px] font-extrabold text-[#2B1A12] group-hover:text-[#CE5535] transition-colors leading-tight">
              <span className="truncate">
                {previewOutletName || outlet?.name || 'Choose Outlet'}
              </span>
              {!isPreviewMode && (
                <ChevronDown
                  className={`w-4 h-4 stroke-[2.8] text-[#2B1A12] shrink-0 transition-transform duration-150 ${
                    isOutletMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              )}
            </div>
          </button>

          {/* Right Logo (64px) */}
          <div className="w-[64px] h-[30px] relative">
            <SafeImage
              src="/assets/logo-orange.v1.webp"
              alt="Zécha!"
              width={64}
              height={30}
              sizes="64px"
              transparent
              className="object-contain object-right w-full h-full"
            />
          </div>

          {/* Outlet Switcher Popover Dropdown */}
          {isOutletMenuOpen && (
            <div className="absolute top-13 left-1/2 -translate-x-1/2 w-[calc(100%-8px)] max-w-[340px] bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] shadow-xl p-2 z-50 space-y-1">
              <p className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#75604F]">
                Switch Outlet
              </p>
              {availableOutlets.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-[#75604F]">Loading outlets...</p>
              ) : (
                availableOutlets.map((o) => {
                  const isCurrent = o.id === outlet?.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleSelectOutletFromDropdown(o)}
                      disabled={!o.isOpen}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition-colors ${
                        !o.isOpen
                          ? 'opacity-50 cursor-not-allowed'
                          : isCurrent
                          ? 'bg-[#FBEDE3] text-[#CE5535]'
                          : 'hover:bg-[#F4E7CC]/50 text-[#2B1A12]'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold block truncate">{o.name}</span>
                        <span className="text-[11px] font-semibold text-[#75604F] block">
                          {o.statusText}
                        </span>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 shrink-0 text-[#CE5535]" />}
                    </button>
                  );
                })
              )}
              <Link
                href="/outlets"
                onClick={() => setIsOutletMenuOpen(false)}
                className="block text-center text-[11px] font-extrabold text-[#CE5535] py-1.5 border-t border-[#EADFC7]/60 mt-1 hover:underline"
              >
                View all outlets
              </Link>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mt-2.5">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#75604F]/60">
            <Search className="w-4 h-4 stroke-[2.2]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search burgers, rolls, boba…"
            className="w-full h-[46px] pl-11 pr-10 rounded-[14px] bg-[#FFFEF7] border border-[#EADFC7] text-xs font-semibold text-[#2B1A12] placeholder:text-[#75604F]/60 focus:outline-none focus:border-[#CE5535] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-3 flex items-center justify-center text-[#75604F] hover:text-[#2B1A12]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Chips Row (only shown when non-empty categories exist, hidden/dimmed irrelevant when searching) */}
        {!isSearching && categories.length > 0 && (
          <div
            data-testid="menu-category-chips"
            className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-1 scrollbar-none -mx-4 px-4 overscroll-x-contain touch-scroll"
          >
            <button
              type="button"
              onClick={() => handleSelectCategory('all')}
              className={`h-8 px-4 rounded-full text-xs font-extrabold whitespace-nowrap transition-transform duration-150 active:scale-95 shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-[#2B1A12] text-[#FDFBEA] shadow-xs'
                  : 'bg-[#F4E7CC] text-[#2B1A12] hover:bg-[#EBD8B7]'
              }`}
            >
              All
            </button>

            {categories.map((cat) => {
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => handleSelectCategory(cat.name)}
                  className={`h-8 px-4 rounded-full text-xs font-extrabold whitespace-nowrap transition-transform duration-150 active:scale-95 shrink-0 ${
                    isActive
                      ? 'bg-[#2B1A12] text-[#FDFBEA] shadow-xs'
                      : 'bg-[#F4E7CC] text-[#2B1A12] hover:bg-[#EBD8B7]'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main ref={listTopRef} className="flex-1 px-4 pt-3 space-y-6">
        {loading ? (
          <div className="space-y-5 pt-2">
            <div className="space-y-3">
              <div className="h-6 w-32 bg-[#F4E7CC]/60 rounded-lg animate-pulse" />
              <div className="flex gap-3 overflow-hidden">
                <div className="w-[46%] shrink-0 h-[230px] bg-[#F4E7CC]/40 rounded-[18px] animate-pulse" />
                <div className="w-[46%] shrink-0 h-[230px] bg-[#F4E7CC]/40 rounded-[18px] animate-pulse" />
                <div className="w-[20%] shrink-0 h-[230px] bg-[#F4E7CC]/30 rounded-[18px] animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-6 w-40 bg-[#F4E7CC]/60 rounded-lg animate-pulse" />
              <div className="h-[120px] bg-[#F4E7CC]/35 rounded-[22px] animate-pulse" />
              <div className="h-[120px] bg-[#F4E7CC]/35 rounded-[22px] animate-pulse" />
            </div>
          </div>
        ) : isSearching ? (
          /* Search Results */
          <div>
            <h2 className="font-display text-[22px] font-extrabold text-[#2B1A12] mb-3 tracking-tight">
              Search Results
            </h2>
            {searchResults.length === 0 ? (
              <div className="bg-white rounded-[22px] border border-[#EADFC7] p-8 text-center text-[#75604F] shadow-2xs">
                <p className="font-bold text-sm">No matching items found</p>
                <p className="text-xs mt-1">Try searching another dish or clear the search</p>
              </div>
            ) : effectiveTheme === 'grid' ? (
              <div data-testid="grid-search-results" className="grid grid-cols-2 gap-3">
                {searchResults.map((item, idx) => renderGridCard(item, idx < 4))}
              </div>
            ) : (
              <div className="bg-white rounded-[22px] border border-[#EADFC7] divide-y divide-[#EADFC7]/70 overflow-hidden shadow-2xs">
                {searchResults.map((item, idx) => renderMenuRow(item, idx < 4))}
              </div>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[22px] border border-[#EADFC7] p-10 text-center text-[#75604F] mt-4">
            <p className="font-extrabold text-base text-[#2B1A12]">Menu coming soon</p>
            <p className="text-xs mt-1">No available items configured for this outlet yet.</p>
          </div>
        ) : (
          <>
            {/* FIRST Section: Per-Outlet Bestsellers Horizontal Swipeable Carousel */}
            {showBestsellersCarousel && (
              <section data-testid="bestsellers-section">
                <h2 className="font-display text-[22px] font-extrabold text-[#2B1A12] mb-3 tracking-tight">
                  Bestsellers
                </h2>

                <div
                  data-testid="bestsellers-carousel"
                  className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-1 scrollbar-none -mx-4 px-4 overscroll-x-contain touch-scroll"
                >
                  {effectiveTheme === 'grid'
                    ? bestsellers.map((item, idx) => renderGridCard(item, idx < 2, true))
                    : bestsellers.map((item, idx) => {
                        const qty = getItemQty(item.id);
                        const lineId = getItemLineId(item.id);

                        return (
                          <div
                            key={item.id}
                            className="w-[46%] shrink-0 snap-start bg-white rounded-[18px] border border-[#EADFC7] p-2 flex flex-col justify-between shadow-2xs hover:border-[#E3D7BC] transition-colors"
                          >
                            <div className="relative w-full h-[158px] rounded-[14px] overflow-visible mb-5">
                              <Link
                                href={`/menu/${item.id}`}
                                className="block w-full h-full rounded-[14px] overflow-hidden relative"
                              >
                                <SafeImage
                                  src={item.image || item.image_url || DEFAULT_MENU_IMAGE}
                                  alt={item.name}
                                  variant="tile"
                                  fill
                                  sizes="(max-width: 430px) 46vw, 198px"
                                  priority={idx < 2}
                                  className="object-cover"
                                />
                              </Link>

                              <div className="absolute top-2 left-2 pointer-events-none z-10">
                                <span className="px-2 py-0.5 rounded-[6px] bg-[#E8B125] text-[#2B1A12] text-[10px] font-black uppercase tracking-wider shadow-xs">
                                  BESTSELLER
                                </span>
                              </div>

                              {qty > 0 && (
                                <div className="absolute top-2 right-2 pointer-events-none z-10">
                                  <span className="px-2 py-0.5 rounded-[6px] bg-[#2B1A12] text-[#FDFBEA] text-[10px] font-black uppercase tracking-wider shadow-xs">
                                    IN CART
                                  </span>
                                </div>
                              )}

                              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20">
                                {qty === 0 ? (
                                  <button
                                    onClick={() => handleAddItem(item)}
                                    className="w-[96px] h-[36px] rounded-[10px] bg-white border border-[#EADFC7] text-[#CE5535] font-black text-xs tracking-wider shadow-md hover:bg-[#FFFEF7] active:scale-95 transition-transform duration-150 flex items-center justify-center uppercase"
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
              </section>
            )}

            {/* Category Sections (ordered 1..12, only non-empty categories rendered) */}
            {groupedSections.map((section, sectionIdx) => (
              <section
                key={section.category.slug}
                data-testid={`category-section-${section.category.slug}`}
              >
                <h2 className="font-display text-[22px] font-extrabold text-[#2B1A12] mb-3 tracking-tight">
                  {section.category.name}
                </h2>

                {effectiveTheme === 'grid' ? (
                  <div className="grid grid-cols-2 gap-3">
                    {section.items.map((item, itemIdx) =>
                      renderGridCard(item, sectionIdx === 0 && itemIdx < 4)
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-[22px] border border-[#EADFC7] divide-y divide-[#EADFC7]/70 overflow-hidden shadow-2xs">
                    {section.items.map((item, itemIdx) =>
                      renderMenuRow(item, sectionIdx === 0 && itemIdx < 3)
                    )}
                  </div>
                )}
              </section>
            ))}
          </>
        )}
      </main>

      {/* Sticky Dark Cart Bar */}
      {count > 0 && (
        <div className="fixed bottom-4 left-0 right-0 max-w-[430px] mx-auto px-4 z-40 pointer-events-auto">
          <Link
            href="/cart"
            prefetch={true}
            className="flex items-center justify-between p-3.5 px-4 rounded-[22px] bg-[#2B1A12] text-[#FDFBEA] shadow-[0_10px_30px_rgba(43,26,18,0.25)] border border-[#2B1A12] active:scale-[0.98] transition-transform duration-150 w-full"
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
                  {formatPrice(toPay)}
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

      {/* Grid Theme Item Detail Bottom Sheet */}
      {detailItem && (
        <div
          data-testid="grid-item-detail-sheet"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#2B1A12]/55 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full max-w-[430px] bg-white rounded-t-[28px] p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl relative animate-in slide-in-from-bottom duration-200 max-h-[88dvh] overflow-y-auto"
            style={{
              transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
              transition: sheetDragY === 0 ? 'transform 180ms ease-out' : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              sheetTouchStartY.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchMove={(e) => {
              if (sheetTouchStartY.current === null) return;
              const delta = e.touches[0].clientY - sheetTouchStartY.current;
              if (delta > 0) setSheetDragY(delta);
            }}
            onTouchEnd={() => {
              if (sheetDragY > 70) {
                setDetailItem(null);
              }
              setSheetDragY(0);
              sheetTouchStartY.current = null;
            }}
          >
            {/* Top drag handle + close X button */}
            <div className="flex items-center justify-between mb-3">
              <div className="w-8" />
              <div className="w-10 h-1.5 rounded-full bg-[#EADFC7]" />
              <button
                type="button"
                data-testid="grid-detail-close"
                onClick={() => setDetailItem(null)}
                aria-label="Close item details"
                className="w-8 h-8 rounded-full bg-[#FAF4E6] hover:bg-[#F4E7CC] flex items-center justify-center text-[#2B1A12]"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Large Photo */}
            <div className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-[#FAF4E6] mb-4">
              <SafeImage
                src={detailItem.image || detailItem.image_url || DEFAULT_MENU_IMAGE}
                alt={detailItem.name}
                variant="tile"
                fill
                sizes="(max-width: 430px) 92vw, 390px"
                className="object-cover"
              />
            </div>

            {/* Veg mark + Name */}
            <div className="flex items-start gap-2 mb-3">
              <div className="pt-1 shrink-0">
                <VegBadge isVeg={detailItem.isVeg ?? detailItem.is_veg ?? true} size="sm" />
              </div>
              <h3 className="font-display font-extrabold text-[20px] text-[#2B1A12] leading-snug">
                {detailItem.name}
              </h3>
            </div>

            {/* Yellow price tag + ADD / Stepper */}
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-block bg-[#FFD23F] text-[#2B1A12] font-extrabold text-[15px] px-2.5 py-1 rounded-[6px] tabular-nums"
                style={{ transform: 'skewX(-8deg)' }}
              >
                <span className="inline-block" style={{ transform: 'skewX(8deg)' }}>
                  {formatPrice(detailItem.price)}
                </span>
              </span>

              {(() => {
                const sheetQty = getItemQty(detailItem.id);
                const sheetLineId = getItemLineId(detailItem.id);
                if (sheetQty === 0) {
                  return (
                    <button
                      type="button"
                      data-testid="grid-detail-add"
                      onClick={() => handleAddItem(detailItem)}
                      className="h-[40px] px-6 rounded-[12px] bg-white border border-[#EADFC7] text-[#CE5535] font-black text-xs tracking-wider shadow-xs hover:bg-[#FFFEF7] active:scale-95 transition-transform uppercase"
                    >
                      ADD
                    </button>
                  );
                }
                return (
                  <div className="h-[40px] min-w-[112px] rounded-[12px] bg-white border border-[#CE5535] text-[#2B1A12] font-black text-xs shadow-xs flex items-center justify-between px-2.5">
                    <button
                      type="button"
                      onClick={() => updateCartQty(sheetLineId, -1)}
                      className="w-7 h-7 flex items-center justify-center text-[#CE5535] hover:bg-[#FBEDE3] rounded"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4 stroke-[3]" />
                    </button>
                    <span className="font-extrabold text-sm">{sheetQty}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(sheetLineId, 1)}
                      className="w-7 h-7 flex items-center justify-center text-[#CE5535] hover:bg-[#FBEDE3] rounded"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Description block (only if non-empty) */}
            {detailItem.description && detailItem.description.trim() && (
              <p
                data-testid="grid-detail-description"
                className="mt-4 pt-3 border-t border-[#EADFC7]/70 text-[13px] text-[#75604F] leading-relaxed"
              >
                {detailItem.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Switch Outlet Confirmation Modal */}
      {pendingSwitchOutlet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2B1A12]/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#FFFEF7] w-full max-w-sm rounded-[24px] border border-[#EADFC7] p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-[#2B1A12]">Switch outlet?</h3>
              <p className="text-sm text-[#75604F]">
                Your cart contains items from{' '}
                <span className="font-bold text-[#2B1A12]">{outlet?.name}</span>. Switching to{' '}
                <span className="font-bold text-[#2B1A12]">{pendingSwitchOutlet.name}</span> will
                clear your current cart.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingSwitchOutlet(null)}
                className="flex-1 h-12 rounded-full border border-[#EADFC7] font-bold text-sm text-[#2B1A12] hover:bg-[#F4E7CC]/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchOutlet}
                className="flex-1 h-12 rounded-full bg-[#CE5535] text-[#FDFBEA] font-bold text-sm hover:bg-[#A8401F] shadow-orange transition-colors"
              >
                Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
          <div className="w-10 h-10 border-3 border-[#CE5535] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MenuPageContent />
    </Suspense>
  );
}
