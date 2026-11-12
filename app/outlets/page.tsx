'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Search,
  Check,
  AlertCircle,
  Clock,
  Moon,
} from 'lucide-react';
import { getOutlets } from '@/lib/api';
import { PICKUP_ETA_TEXT, getOutletAvailability } from '@/lib/outlets';
import { Outlet } from '@/types';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { SafeImage } from '@/components/ui/SafeImage';

export default function OutletsPage() {
  const router = useRouter();
  const { outlet: selectedOutlet, setOutlet, cart, clearCart } = useZechaStore();
  const { showToast } = useToast();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSwitchOutlet, setPendingSwitchOutlet] = useState<Outlet | null>(null);
  const [, setClockTick] = useState(0);
  const [animateInitialCards, setAnimateInitialCards] = useState(true);

  const selectedOutletRef = useRef<Outlet | null>(selectedOutlet);
  selectedOutletRef.current = selectedOutlet;
  const hasLoadedOnceRef = useRef(false);

  // Ensure nothing is pre-selected on fresh load when cart is empty
  useEffect(() => {
    if (cart.length === 0 && selectedOutletRef.current) {
      setOutlet(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOutlets = useCallback(
    async (isBackground = false) => {
      try {
        if (!isBackground) {
          setLoading(true);
        }
        const data = await getOutlets();
        setOutlets(data);
        if (!hasLoadedOnceRef.current) {
          hasLoadedOnceRef.current = true;
          setTimeout(() => setAnimateInitialCards(false), 600);
        }

        const currentSel = selectedOutletRef.current;
        if (currentSel) {
          const match = data.find((o) => o.id === currentSel.id);
          if (!match || !match.isOpen) {
            setOutlet(null);
            showToast('That outlet is no longer available. Please choose another.', 'info');
          } else if (
            match.name !== currentSel.name ||
            match.address !== currentSel.address ||
            match.statusText !== currentSel.statusText
          ) {
            setOutlet(match);
          }
        }
      } catch (err) {
        console.error('Failed to fetch outlets:', err);
      } finally {
        if (!isBackground) {
          setLoading(false);
        }
      }
    },
    [setOutlet, showToast]
  );

  useEffect(() => {
    loadOutlets(false);

    const handleFocus = () => {
      loadOutlets(true);
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadOutlets(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollInterval = setInterval(() => {
      setClockTick((t) => t + 1);
      loadOutlets(true);
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [loadOutlets]);

  // Filter outlets by search query & compute live IST open/closed status
  const processedOutlets = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();

    return outlets
      .filter((o) => {
        if (!queryLower) return true;
        return (
          o.name.toLowerCase().includes(queryLower) ||
          (o.address || '').toLowerCase().includes(queryLower)
        );
      })
      .map((o) => {
        const availability = getOutletAvailability(
          o.openingTime,
          o.closingTime,
          o.is_active !== false
        );
        return {
          ...o,
          isOpen: availability.isOpen,
          openStatusText: availability.statusText,
          readyTime: PICKUP_ETA_TEXT,
        };
      });
  }, [outlets, searchQuery]);

  const handleCardClick = (item: Outlet & { isOpen: boolean }) => {
    if (!item.isOpen) {
      showToast(`${item.name} is currently closed`, 'info');
      return;
    }

    if (selectedOutlet && selectedOutlet.id !== item.id && cart.length > 0) {
      setPendingSwitchOutlet(item);
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(10);
      } catch {}
    }
    setOutlet(item);
  };

  const handleConfirmSwitch = () => {
    if (pendingSwitchOutlet) {
      clearCart();
      setOutlet(pendingSwitchOutlet);
      setPendingSwitchOutlet(null);
      showToast('Switched outlet. Cart was cleared.', 'info');
    }
  };

  const handleContinue = () => {
    if (!selectedOutlet || !selectedOutlet.isOpen) return;
    router.push('/menu');
  };

  return (
    <div className="h-[100dvh] w-full bg-[#FDFBEA] flex flex-col overflow-hidden page-transition select-none">
      {/* Fixed Header: Back button, logo, title & search */}
      <header className="shrink-0 px-5 pt-4 pb-3 bg-[#FDFBEA]">
        <div className="flex items-center justify-between pt-1 mb-5">
          <Link
            href="/"
            className="w-11 h-11 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC]/50 transition-colors shadow-2xs"
            aria-label="Back to welcome"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>

          <div className="relative w-[72px] h-[32px]">
            <SafeImage
              src="/assets/logo-orange.v1.webp"
              alt="Zécha!"
              width={72}
              height={32}
              sizes="72px"
              transparent
              className="object-contain object-right w-full h-full"
            />
          </div>
        </div>

        <h1 className="font-display text-[30px] font-extrabold text-[#2B1A12] leading-[1.08] tracking-tight">
          Choose your<br />outlet
        </h1>
        <p className="text-[14px] text-[#75604F] mt-[4px] mb-4 font-medium">
          Pick where you&apos;ll collect your order.
        </p>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#75604F]/60">
            <Search className="w-4 h-4 stroke-[2]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search outlet or area"
            className="w-full h-[50px] pl-11 pr-4 rounded-[16px] bg-[#FFFEF7] border border-[#EADFC7] text-sm font-semibold text-[#2B1A12] placeholder:text-[#75604F]/60 focus:outline-none focus:border-[#CE5535] focus:ring-1 focus:ring-[#CE5535] transition-all"
          />
        </div>
      </header>

      {/* Scrollable Outlet List Container */}
      <div
        data-testid="outlets-scroll-list"
        role="radiogroup"
        aria-label="Choose your outlet"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-scroll px-5 pt-2 pb-[calc(40px+env(safe-area-inset-bottom))] space-y-[12px]"
      >
        {loading ? (
          [1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-[126px] rounded-[22px] bg-[#F4E7CC]/40 border-[1.5px] border-[#EADFC7] animate-pulse"
            />
          ))
        ) : processedOutlets.length === 0 ? (
          <div className="text-center py-12 text-[#75604F]">
            <p className="font-bold text-base">No outlets found</p>
            <p className="text-xs mt-1">
              {searchQuery ? 'Try a different search term' : 'No active outlets available right now'}
            </p>
          </div>
        ) : (
          processedOutlets.map((item, idx) => {
            const isSelected = selectedOutlet?.id === item.id;
            const isClosed = !item.isOpen;
            const trimmedAddress = (item.address || '').trim();
            const shouldAnimateEnter = animateInitialCards && idx < 6;

            return (
              <div
                key={item.id}
                data-testid={`outlet-card-${item.id}`}
                onClick={() => {
                  if (!isClosed) handleCardClick(item);
                }}
                role="radio"
                aria-checked={isSelected}
                aria-disabled={isClosed}
                tabIndex={isClosed ? -1 : 0}
                onKeyDown={(e) => {
                  if (isClosed) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(item);
                  }
                }}
                style={
                  shouldAnimateEnter ? { animationDelay: `${idx * 40}ms` } : undefined
                }
                className={`relative overflow-hidden w-full rounded-[22px] bg-[#FFFEF7] border-[1.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CE5535] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBEA] ${
                  shouldAnimateEnter ? 'zecha-card-enter' : ''
                } ${
                  isClosed
                    ? 'opacity-[0.62] border-[#EADFC7] cursor-default'
                    : isSelected
                    ? 'border-[#CE5535] shadow-[inset_0_0_0_0.5px_#CE5535,0_0_0_4px_rgba(206,85,53,0.14)] cursor-pointer zecha-card-press'
                    : 'border-[#EADFC7] cursor-pointer zecha-card-press'
                }`}
              >
                {/* Decorative Terracotta Cup Watermark */}
                <img
                  src="/assets/mascot-orange.v1.webp"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute -right-[10px] top-[4px] w-[104px] h-auto"
                  style={{
                    transform: 'rotate(12deg)',
                    opacity: isSelected ? 0.07 : 0.06,
                  }}
                />

                {/* Top section */}
                <div className="relative z-10 flex items-center gap-[14px] p-[14px]">
                  {/* 58x58 Cup Tile */}
                  <div
                    className={`w-[58px] h-[58px] rounded-[18px] relative flex items-center justify-center shrink-0 ${
                      isClosed ? 'bg-[#F4E7CC]' : 'bg-[#CE5535]'
                    }`}
                  >
                    {!isClosed && (
                      <>
                        <span
                          className="zecha-steam-bar absolute top-[9px] left-[21px] w-[2px] h-[8px] rounded-[2px] bg-[#FDFBEA]"
                          style={{ animationDelay: '0s' }}
                        />
                        <span
                          className="zecha-steam-bar absolute top-[9px] left-[28px] w-[2px] h-[8px] rounded-[2px] bg-[#FDFBEA]"
                          style={{ animationDelay: '0.5s' }}
                        />
                        <span
                          className="zecha-steam-bar absolute top-[9px] left-[35px] w-[2px] h-[8px] rounded-[2px] bg-[#FDFBEA]"
                          style={{ animationDelay: '1s' }}
                        />
                      </>
                    )}
                    <img
                      src={isClosed ? '/assets/mascot-orange.v1.webp' : '/assets/mascot-cream.v1.webp'}
                      alt=""
                      aria-hidden="true"
                      className={`w-[30px] h-auto object-contain ${isClosed ? '' : 'mt-[8px]'}`}
                    />
                  </div>

                  {/* Outlet Name & Address */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[17px] font-extrabold text-[#2B1A12] leading-[1.15] truncate">
                      {item.name}
                    </h2>
                    {trimmedAddress && (
                      <p className="text-[13px] text-[#75604F] mt-0.5 font-medium leading-tight truncate">
                        {trimmedAddress}
                      </p>
                    )}
                  </div>

                  {/* Radio Circle */}
                  <div className="shrink-0">
                    {isSelected ? (
                      <div className="w-[26px] h-[26px] rounded-full bg-[#CE5535] text-white flex items-center justify-center">
                        <Check
                          className="w-3.5 h-3.5 zecha-check-pop"
                          strokeWidth={3.2}
                        />
                      </div>
                    ) : (
                      <div className="w-[26px] h-[26px] rounded-full border-2 border-[#D9CBAE]" />
                    )}
                  </div>
                </div>

                {/* Ticket Divider with Edge Notches */}
                <div className="relative z-10 w-full border-t-[1.5px] border-dashed border-[#EADFC7]">
                  <span
                    aria-hidden="true"
                    className={`w-[22px] h-[22px] rounded-full bg-[#FDFBEA] border-[1.5px] absolute left-[-12px] top-[-11px] pointer-events-none ${
                      isSelected ? 'border-[#CE5535]' : 'border-[#EADFC7]'
                    }`}
                  />
                  <span
                    aria-hidden="true"
                    className={`w-[22px] h-[22px] rounded-full bg-[#FDFBEA] border-[1.5px] absolute right-[-12px] top-[-11px] pointer-events-none ${
                      isSelected ? 'border-[#CE5535]' : 'border-[#EADFC7]'
                    }`}
                  />
                </div>

                {/* Bottom Strip */}
                <div
                  className={`relative z-10 flex items-center justify-between gap-2 px-[14px] py-[11px] text-[12px] ${
                    isClosed
                      ? 'bg-[#F4EBD6]'
                      : isSelected
                      ? 'bg-[#FCE9DF] font-bold'
                      : 'bg-[#F8F0DC] font-bold'
                  }`}
                >
                  {isClosed ? (
                    <>
                      <span className="flex items-center gap-1.5 font-bold text-[#BA1A1A] min-w-0 truncate">
                        <Moon className="w-[14px] h-[14px] shrink-0" />
                        <span className="truncate">{item.openStatusText}</span>
                      </span>
                      <span className="text-[12px] font-semibold text-[#75604F] shrink-0">
                        Not available now
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5 font-bold text-[#2F7A3E] min-w-0 truncate">
                        <span className="zecha-pulse-dot w-[7px] h-[7px] rounded-full bg-[#2F7A3E] shrink-0" />
                        <span className="truncate">{item.openStatusText}</span>
                      </span>
                      <span
                        className={`flex items-center gap-1 font-bold shrink-0 ${
                          isSelected ? 'text-[#A8401F]' : 'text-[#5A4334]'
                        }`}
                      >
                        <Clock className="w-[14px] h-[14px] shrink-0" />
                        <span>{item.readyTime}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Fixed Bottom CTA Bar */}
      <footer className="shrink-0 w-full px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-[#FDFBEA]/95 backdrop-blur-md border-t border-[#EADFC7]/80 z-20 space-y-2">
        {selectedOutlet && (
          <p className="text-center text-xs font-bold text-[#75604F] truncate">
            Pickup from{' '}
            <span className="text-[#2B1A12] font-black">{selectedOutlet.name}</span>
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedOutlet || !selectedOutlet.isOpen}
          className={`w-full h-[56px] rounded-[20px] font-extrabold text-[16px] flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(206,85,53,0.25)] transition-all ${
            !selectedOutlet || !selectedOutlet.isOpen
              ? 'bg-[#CE5535]/40 text-[#FDFBEA]/70 cursor-not-allowed shadow-none'
              : 'bg-[#CE5535] text-[#FDFBEA] hover:bg-[#A8401F] active:scale-[0.98]'
          }`}
        >
          <span>Continue to menu</span>
          <span className="text-xl">→</span>
        </button>
      </footer>

      {/* Switch Outlet Confirmation Sheet / Modal */}
      {pendingSwitchOutlet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2B1A12]/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#FFFEF7] w-full max-w-sm rounded-[24px] border border-[#EADFC7] p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-[#2B1A12]">
                Switch outlet?
              </h3>
              <p className="text-sm text-[#75604F]">
                Your cart contains items from{' '}
                <span className="font-bold text-[#2B1A12]">
                  {selectedOutlet?.name}
                </span>
                . Switching to{' '}
                <span className="font-bold text-[#2B1A12]">
                  {pendingSwitchOutlet.name}
                </span>{' '}
                will clear your current cart.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setPendingSwitchOutlet(null)}
                className="flex-1 h-12 rounded-full border border-[#EADFC7] font-bold text-sm text-[#2B1A12] hover:bg-[#F4E7CC]/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSwitch}
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
