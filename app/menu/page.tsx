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
import { Combo, MenuItem, MenuTheme, Outlet } from '@/types';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { VegBadge } from '@/components/ui/VegBadge';
import { SafeImage } from '@/components/ui/SafeImage';
import { DEFAULT_MENU_IMAGE } from '@/lib/images';
import { formatPrice, cn } from '@/lib/utils';
import { useAppSettingsStore } from '@/lib/app-settings';

function PickupIllustration({
  width = 72,
  height = 72,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pickupBagGrad" x1="20" y1="24" x2="60" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A0522D" />
          <stop offset="100%" stopColor="#8B4513" />
        </linearGradient>
      </defs>

      {/* Subtle drop shadow at base */}
      <ellipse cx="40" cy="71" rx="22" ry="4" fill="rgba(0,0,0,0.12)" />

      {/* Steam wisps rising with cubic bezier curves */}
      <path
        d="M32 20C30 15 36 11 33 6C31 3 34 1 32 0"
        stroke="#D4C5B0"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M41 22C43 17 38 13 41 8C43 5 40 2 42 0"
        stroke="#D4C5B0"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M49 21C47 16 53 12 50 7C48 4 51 2 49 1"
        stroke="#D4C5B0"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* Back bag handle */}
      <path
        d="M34 24C34 18 37 13 41 13C45 13 48 18 48 24"
        stroke="#6B3410"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Front bag handle */}
      <path
        d="M31 24C31 16 35 11 39 11C43 11 47 16 47 24"
        stroke="#6B3410"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Paper bag body: tapered rounded rectangle */}
      <path
        d="M20 24H60L57.5 64C57.5 66.5 55.5 68 53 68H27C24.5 68 22.5 66.5 22.5 64L20 24Z"
        fill="url(#pickupBagGrad)"
      />

      {/* Side 3D facet fold */}
      <path
        d="M20 24L22.5 64C22.5 66.5 24.5 68 27 68H30L26 24H20Z"
        fill="#6B3410"
        opacity="0.35"
      />

      {/* Top collar / folded rim */}
      <path
        d="M18 23C18 21.5 19.5 20.5 21 20.5H59C60.5 20.5 62 21.5 62 23V27C62 27.8 61.2 28.5 60.5 28.5H19.5C18.8 28.5 18 27.8 18 27V23Z"
        fill="#A0522D"
      />
      <path
        d="M19 26.5H61"
        stroke="#6B3410"
        strokeWidth="1"
        strokeDasharray="3 2"
      />

      {/* Bag texture lines across body */}
      <path
        d="M23 42L40 45L57 42"
        stroke="#6B3410"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <path
        d="M24 57L40 60L56 57"
        stroke="#6B3410"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />

      {/* Zechai-orange sticker/seal */}
      <circle cx="40" cy="46" r="10" fill="#E85D2A" />
      <circle
        cx="40"
        cy="46"
        r="8.2"
        stroke="#FFF8F0"
        strokeWidth="1"
        strokeOpacity="0.8"
        strokeDasharray="2.5 1.5"
        fill="none"
      />
      <path
        d="M36.5 43H43.5L37 49H44"
        stroke="#FFF8F0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function DineInIllustration({
  width = 72,
  height = 72,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="clocheGrad" x1="26" y1="20" x2="54" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D8D8D8" />
          <stop offset="40%" stopColor="#C0C0C0" />
          <stop offset="100%" stopColor="#A0A0A0" />
        </linearGradient>
      </defs>

      {/* Subtle drop shadow at base */}
      <ellipse cx="40" cy="71" rx="26" ry="4.5" fill="rgba(0,0,0,0.12)" />

      {/* Steam wisps from under lifted dome with cubic bezier curves */}
      <path
        d="M33 34C31 28 37 23 34 16C32 12 36 8 33 4"
        stroke="#D4C5B0"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M43 36C45 29 40 24 43 17C45 13 41 9 44 5"
        stroke="#D4C5B0"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M52 38C50 31 55 26 53 19C51 15 54 11 52 7"
        stroke="#D4C5B0"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* Sparkle/shine marks in orange */}
      <path
        d="M58 13L59 15.5L61.5 16.5L59 17.5L58 20L57 17.5L54.5 16.5L57 15.5Z"
        fill="#E85D2A"
        opacity="0.6"
      />
      <path
        d="M22 19L22.8 21.2L25 22L22.8 22.8L22 25L21.2 22.8L19 22L21.2 21.2Z"
        fill="#E85D2A"
        opacity="0.6"
      />
      <path
        d="M63 27L63.6 28.6L65.2 29.2L63.6 29.8L63 31.4L62.4 29.8L60.8 29.2L62.4 28.6Z"
        fill="#E85D2A"
        opacity="0.6"
      />

      {/* Fork on the left */}
      <path
        d="M12 44V64C12 65.5 13.5 66.5 15 66.5C16.5 66.5 18 65.5 18 64V44C18 41 20 38.5 20.5 35V27H19V33.5H16.5V27H15V33.5H13.5V27H12V33.5H9.5V27H8V35C8.5 38.5 10.5 41 12 44Z"
        fill="#8B6914"
      />

      {/* Knife on the right */}
      <path
        d="M63 44V64C63 65.5 64.5 66.5 66 66.5C67.5 66.5 69 65.5 69 64V44C69 41 71.5 37 71.5 33C71.5 28 67 27 66 27V42H64.5C63.5 42 63 43 63 44Z"
        fill="#8B6914"
      />

      {/* Outer plate */}
      <ellipse
        cx="40"
        cy="63"
        rx="26"
        ry="7"
        fill="#FFF5E6"
        stroke="#C4A882"
        strokeWidth="2"
      />

      {/* Second 3D inner ellipse */}
      <ellipse
        cx="40"
        cy="62"
        rx="21"
        ry="5.2"
        fill="#FFFFFF"
        stroke="#C4A882"
        strokeWidth="1.2"
        strokeOpacity="0.7"
      />
      <ellipse
        cx="40"
        cy="61.5"
        rx="16"
        ry="3.5"
        fill="#FFF5E6"
        stroke="#D4C5B0"
        strokeWidth="0.8"
      />

      {/* Tilted cloche dome suggesting being lifted */}
      <g transform="rotate(-8 40 44)">
        {/* Dome arc body */}
        <path
          d="M22 47C22 31 30 22 40 22C50 22 58 31 58 47H22Z"
          fill="url(#clocheGrad)"
          stroke="#8C8C8C"
          strokeWidth="1.2"
        />
        {/* Specular highlight */}
        <path
          d="M28 44C28 33 33 26 40 25C35 27 31 33 31 44H28Z"
          fill="#FFFFFF"
          opacity="0.5"
        />
        {/* Cloche rim */}
        <ellipse cx="40" cy="47" rx="18.5" ry="3" fill="#A0A0A0" stroke="#7A7A7A" strokeWidth="1" />
        <ellipse cx="40" cy="46.5" rx="18" ry="2.6" fill="#C8C8C8" />
        {/* Top knob handle */}
        <ellipse cx="40" cy="20.5" rx="3.5" ry="3.5" fill="#696969" stroke="#4A4A4A" strokeWidth="1" />
        <ellipse cx="39" cy="19.5" rx="1.2" ry="1" fill="#FFFFFF" opacity="0.6" />
      </g>
    </svg>
  );
}

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlOutletId = (searchParams.get('outlet') || '').trim();
  const previewThemeParam = searchParams.get('preview_theme');
  const isPreviewMode = searchParams.get('preview') === '1';

  const {
    outlet,
    setOutlet,
    orderType,
    setOrderType,
    cart,
    addItem,
    addCombo,
    updateCartQty,
    clearCart,
  } = useZechaStore();
  const { showToast } = useToast();

  const [menuTheme, setMenuTheme] = useState<MenuTheme>('classic');
  const [categories, setCategories] = useState<MenuCategoryDef[]>([]);
  const [bestsellers, setBestsellers] = useState<MenuItem[]>([]);
  const [bestsellerIds, setBestsellerIds] = useState<string[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  const { isCombosEnabled, fetchSettings: fetchAppSettings } = useAppSettingsStore();

  useEffect(() => {
    fetchAppSettings();
  }, [fetchAppSettings]);

  useEffect(() => {
    if (!isCombosEnabled()) {
      setCombos([]);
    }
  }, [isCombosEnabled]);
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

  const { count, itemsTotal } = getCartSummary(cart);

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
        setCombos(isCombosEnabled() ? (data.combos || []) : []);

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

  const getComboQty = (comboId: string) => {
    return cart
      .filter((i) => i.isCombo && i.itemId === comboId)
      .reduce((sum, i) => sum + i.qty, 0);
  };

  const getComboLineId = (comboId: string) => {
    const found = cart.find((i) => i.isCombo && i.itemId === comboId);
    return found ? found.lineId : 'combo-' + comboId;
  };

  const handleAddCombo = (combo: Combo) => {
    if (!combo.is_available) {
      showToast('This combo is currently sold out', 'info');
      return;
    }
    addCombo({
      id: combo.id,
      outlet_id: combo.outlet_id,
      name: combo.name,
      price: combo.price,
      image: combo.image || combo.image_url || undefined,
      isVeg: combo.is_veg,
      items_total: combo.items_total,
      savings: combo.savings,
      items: (combo.items || []).map((it) => ({
        menu_item_id: it.menu_item_id,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        category: it.category,
        is_veg: it.is_veg,
        outlet_id: it.outlet_id || combo.outlet_id,
      })),
    });
    showToast(`Added ${combo.name} to cart`, 'success');
  };

  // Search matches across ALL categories & combos (ignores chip selection while typing)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { items: [], combos: [] };
    const matchedItems = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
    );
    const matchedCombos = combos.filter(
      (combo) =>
        combo.name.toLowerCase().includes(q) ||
        (combo.description || '').toLowerCase().includes(q) ||
        combo.items?.some((ci) => ci.name.toLowerCase().includes(q))
    );
    return { items: matchedItems, combos: matchedCombos };
  }, [items, combos, searchQuery]);

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

  const renderClassicComboRow = (combo: Combo) => {
    const qty = getComboQty(combo.id);
    const lineId = getComboLineId(combo.id);

    return (
      <div
        key={combo.id}
        className="p-3.5 sm:p-4 flex items-start justify-between gap-3 hover:bg-[#FAF4E6]/30 transition-colors"
      >
        {/* Left column: Name, price, savings, description, included items */}
        <div className="flex-1 min-w-0 pr-1 block">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <VegBadge isVeg={combo.is_veg} size="sm" />
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange text-white">
              Combo
            </span>
          </div>

          <h3 className="font-extrabold text-[16px] text-[#2B1A12] leading-snug">
            {combo.name}
          </h3>

          <div className="mt-1 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFD23F] text-[#2B1A12]">
              {combo.items_total && combo.items_total > combo.price && (
                <span className="text-[12px] text-[#2B1A12]/75 line-through font-semibold">
                  {formatPrice(combo.items_total)}
                </span>
              )}
              <span className="font-black text-[14px] text-[#2B1A12]">
                {formatPrice(combo.price)}
              </span>
            </span>
          </div>

          {combo.description && (
            <p className="text-[13px] text-[#75604F] leading-relaxed line-clamp-2">
              {combo.description}
            </p>
          )}

          {combo.items && combo.items.length > 0 && (
            <p className="text-[11px] font-bold text-[#75604F]/90 mt-1.5 leading-snug">
              Includes:{' '}
              <span className="text-[#2B1A12]">
                {combo.items
                  .map((ci) => `${ci.quantity > 1 ? `${ci.quantity}x ` : ''}${ci.name}`)
                  .join(' · ')}
              </span>
            </p>
          )}
        </div>

        {/* Right column: 124px photo with overlapping ADD/stepper button */}
        <div className="relative w-[124px] h-[116px] shrink-0 mb-3">
          <div className="block w-full h-[96px] rounded-[14px] overflow-hidden relative border border-[#EADFC7]/60">
            <SafeImage
              src={combo.image || combo.image_url || DEFAULT_MENU_IMAGE}
              alt={combo.name}
              variant="thumb"
              fill
              sizes="124px"
              className="object-cover"
            />
          </div>

          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20">
            {!combo.is_available ? (
              <span className="w-[96px] h-[34px] rounded-[10px] bg-[#F4E7CC]/80 border border-[#EADFC7] text-[#75604F] font-bold text-[11px] uppercase tracking-wider flex items-center justify-center">
                Sold out
              </span>
            ) : qty === 0 ? (
              <button
                onClick={() => handleAddCombo(combo)}
                className="w-[96px] h-[34px] rounded-[10px] bg-white border border-[#EADFC7] text-[#CE5535] font-black text-xs tracking-wider shadow-md hover:bg-[#FFFEF7] active:scale-95 transition-transform duration-150 flex items-center justify-center uppercase"
              >
                ADD
              </button>
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

  const renderGridComboCard = (combo: Combo) => {
    const qty = getComboQty(combo.id);
    const lineId = getComboLineId(combo.id);

    return (
      <div
        key={combo.id}
        className="bg-white rounded-[22px] border border-[#EADFC7]/80 p-2.5 flex flex-col justify-between shadow-2xs space-y-2"
      >
        <div>
          <div className="block w-full aspect-[4/3] rounded-[16px] overflow-hidden relative bg-[#FAF4E6]">
            <SafeImage
              src={combo.image || combo.image_url || DEFAULT_MENU_IMAGE}
              alt={combo.name}
              variant="tile"
              fill
              sizes="(max-width: 430px) 46vw, 198px"
              className="object-cover"
            />
          </div>

          <div className="mt-2 flex items-start gap-1.5">
            <div className="pt-0.5 shrink-0">
              <VegBadge isVeg={combo.is_veg} size="sm" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-[14px] text-[#2B1A12] leading-snug line-clamp-1">
                {combo.name}
              </h3>
              {combo.items && combo.items.length > 0 && (
                <p className="text-[11px] text-[#75604F] line-clamp-1 mt-0.5">
                  {combo.items
                    .map((ci) => `${ci.quantity > 1 ? `${ci.quantity}x ` : ''}${ci.name}`)
                    .join(' + ')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-between gap-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FFD23F] text-[#2B1A12]">
            {combo.items_total && combo.items_total > combo.price && (
              <span className="text-[11px] text-[#2B1A12]/75 line-through font-semibold">
                {formatPrice(combo.items_total)}
              </span>
            )}
            <span className="font-black text-[13px] text-[#2B1A12]">
              {formatPrice(combo.price)}
            </span>
          </span>

          {!combo.is_available ? (
            <span className="h-[30px] px-2.5 rounded-[8px] bg-[#F4E7CC]/60 text-[#75604F] font-bold text-[10px] uppercase flex items-center justify-center">
              Sold out
            </span>
          ) : qty === 0 ? (
            <button
              onClick={() => handleAddCombo(combo)}
              className="h-[30px] px-3 rounded-[8px] bg-white border border-[#CE5535] text-[#CE5535] font-black text-xs hover:bg-[#FBEDE3] active:scale-95 transition-all uppercase"
            >
              ADD
            </button>
          ) : (
            <div className="h-[30px] px-2 rounded-[8px] bg-white border border-[#CE5535] text-[#2B1A12] font-black text-xs flex items-center gap-1.5">
              <button
                onClick={() => updateCartQty(lineId, -1)}
                className="w-5 h-5 flex items-center justify-center text-[#CE5535]"
              >
                <Minus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
              <span className="w-3 text-center">{qty}</span>
              <button
                onClick={() => updateCartQty(lineId, 1)}
                className="w-5 h-5 flex items-center justify-center text-[#CE5535]"
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
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EADFC7]/60">
        {/* Order Mode Selector (Swiggy-style Food/Instamart top selector) */}
        <div className="w-full px-4 pt-3 pb-2 sticky top-0 z-30 bg-[#FFF8F0]">
          <div className="w-full max-w-md mx-auto flex gap-3" role="tablist" aria-label="Order mode">
            {/* Pickup Card */}
            <button
              type="button"
              role="tab"
              aria-selected={orderType === 'pickup'}
              onClick={() => setOrderType('pickup')}
              className={cn(
                orderType === 'pickup'
                  ? 'flex-1 flex flex-col items-center py-4 px-3 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] border border-orange-100 cursor-pointer transition-all duration-200'
                  : 'flex-1 flex flex-col items-center py-4 px-3 rounded-2xl bg-transparent cursor-pointer transition-all duration-200'
              )}
            >
              <PickupIllustration
                width={72}
                height={72}
                className={cn(
                  'w-[72px] h-[72px] transition-opacity duration-200',
                  orderType === 'pickup' ? 'opacity-100' : 'opacity-50'
                )}
              />
              <span
                className={cn(
                  'text-[15px] mt-1 transition-colors duration-200',
                  orderType === 'pickup' ? 'font-semibold text-gray-900' : 'font-normal text-gray-400'
                )}
              >
                Pickup
              </span>
              {orderType === 'pickup' ? (
                <div className="w-10 h-[3px] rounded-full bg-[#E85D2A] mt-2" />
              ) : (
                <div className="w-10 h-[3px] mt-2 opacity-0" />
              )}
            </button>

            {/* Dine In Card */}
            <button
              type="button"
              role="tab"
              aria-selected={orderType === 'dine_in'}
              onClick={() => setOrderType('dine_in')}
              className={cn(
                orderType === 'dine_in'
                  ? 'flex-1 flex flex-col items-center py-4 px-3 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] border border-orange-100 cursor-pointer transition-all duration-200'
                  : 'flex-1 flex flex-col items-center py-4 px-3 rounded-2xl bg-transparent cursor-pointer transition-all duration-200'
              )}
            >
              <DineInIllustration
                width={72}
                height={72}
                className={cn(
                  'w-[72px] h-[72px] transition-opacity duration-200',
                  orderType === 'dine_in' ? 'opacity-100' : 'opacity-50'
                )}
              />
              <span
                className={cn(
                  'text-[15px] mt-1 transition-colors duration-200',
                  orderType === 'dine_in' ? 'font-semibold text-gray-900' : 'font-normal text-gray-400'
                )}
              >
                Dine In
              </span>
              {orderType === 'dine_in' ? (
                <div className="w-10 h-[3px] rounded-full bg-[#E85D2A] mt-2" />
              ) : (
                <div className="w-10 h-[3px] mt-2 opacity-0" />
              )}
            </button>
          </div>
        </div>

        {/* Outlet Switcher, Search Bar, and Category Chips */}
        <div className="px-4 pt-2.5 pb-2">
          <div className="flex items-center justify-between relative" ref={dropdownRef}>
            {/* Back button */}
            <Link
              href="/outlets"
              className="w-11 h-11 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC]/50 transition-colors shadow-2xs"
              aria-label="Back to outlets"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </Link>

            {/* Center: PICKUP FROM / DINE IN AT outlet switcher */}
            <button
              type="button"
              onClick={handleToggleOutletDropdown}
              className="flex flex-col items-center group text-center cursor-pointer max-w-[210px] py-1 px-2 rounded-xl hover:bg-[#F4E7CC]/40 transition-colors"
              aria-expanded={isOutletMenuOpen}
              aria-label="Switch outlet"
            >
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#E85D2A]">
                {orderType === 'dine_in' ? 'DINE IN AT' : 'PICKUP FROM'}
              </span>
              <div className="flex items-center gap-1 text-[15px] font-semibold text-gray-900 group-hover:text-[#E85D2A] transition-colors leading-tight">
                <span className="truncate">
                  {previewOutletName || outlet?.name || 'Choose Outlet'}
                </span>
                {!isPreviewMode && (
                  <ChevronDown
                    className={`w-4 h-4 stroke-[2.8] text-gray-900 shrink-0 transition-transform duration-150 ${
                      isOutletMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </div>
              {orderType === 'dine_in' && (
                <span className="text-[11px] text-gray-400 font-normal tracking-tight mt-0.5 block leading-tight">
                  Tables available on a first-come basis
                </span>
              )}
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
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-[calc(100%-8px)] max-w-[340px] bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] shadow-xl p-2 z-50 space-y-1">
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
        {!isSearching && (categories.length > 0 || combos.length > 0) && (
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

            {combos.length > 0 && (
              <button
                type="button"
                onClick={() => handleSelectCategory('combos')}
                className={`h-8 px-4 rounded-full text-xs font-extrabold whitespace-nowrap transition-transform duration-150 active:scale-95 shrink-0 flex items-center gap-1.5 ${
                  selectedCategory === 'combos'
                    ? 'bg-[#2B1A12] text-[#FDFBEA] shadow-xs'
                    : 'bg-[#FBEDE3] text-[#CE5535] border border-[#CE5535]/30 hover:bg-[#F9DEC9]'
                }`}
              >
                <span>Combos</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#CE5535]" />
              </button>
            )}

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
        </div>
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
            {searchResults.items.length === 0 && searchResults.combos.length === 0 ? (
              <div className="bg-white rounded-[22px] border border-[#EADFC7] p-8 text-center text-[#75604F] shadow-2xs">
                <p className="font-bold text-sm">No matching items found</p>
                <p className="text-xs mt-1">Try searching another dish or clear the search</p>
              </div>
            ) : (
              <div className="space-y-6">
                {searchResults.combos.length > 0 && (
                  <div>
                    <h3 className="font-extrabold text-sm text-[#75604F] uppercase tracking-wider mb-2.5">
                      Combos ({searchResults.combos.length})
                    </h3>
                    {effectiveTheme === 'grid' ? (
                      <div className="grid grid-cols-2 gap-3">
                        {searchResults.combos.map((combo) => renderGridComboCard(combo))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-[22px] border border-[#EADFC7] divide-y divide-[#EADFC7]/70 overflow-hidden shadow-2xs">
                        {searchResults.combos.map((combo) => renderClassicComboRow(combo))}
                      </div>
                    )}
                  </div>
                )}

                {searchResults.items.length > 0 && (
                  <div>
                    {searchResults.combos.length > 0 && (
                      <h3 className="font-extrabold text-sm text-[#75604F] uppercase tracking-wider mb-2.5">
                        Individual Items ({searchResults.items.length})
                      </h3>
                    )}
                    {effectiveTheme === 'grid' ? (
                      <div data-testid="grid-search-results" className="grid grid-cols-2 gap-3">
                        {searchResults.items.map((item, idx) => renderGridCard(item, idx < 4))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-[22px] border border-[#EADFC7] divide-y divide-[#EADFC7]/70 overflow-hidden shadow-2xs">
                        {searchResults.items.map((item, idx) => renderMenuRow(item, idx < 4))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : items.length === 0 && combos.length === 0 ? (
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

            {/* Combos Section (FIRST above all categories) */}
            {(selectedCategory === 'all' || selectedCategory === 'combos') && combos.length > 0 && (
              <section data-testid="combos-section" className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-[22px] font-extrabold text-[#2B1A12] tracking-tight">
                      Combos
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#CE5535] text-white shadow-xs">
                      Special Value
                    </span>
                  </div>
                </div>

                {effectiveTheme === 'grid' ? (
                  <div className="grid grid-cols-2 gap-3">
                    {combos.map((combo) => renderGridComboCard(combo))}
                  </div>
                ) : (
                  <div className="bg-white rounded-[22px] border border-[#EADFC7] divide-y divide-[#EADFC7]/70 overflow-hidden shadow-2xs">
                    {combos.map((combo) => renderClassicComboRow(combo))}
                  </div>
                )}
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
                  {formatPrice(itemsTotal)}
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
