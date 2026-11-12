'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getOutlets } from '@/lib/api';
import { PICKUP_ETA_TEXT, getOutletAvailability } from '@/lib/outlets';
import { Outlet } from '@/types';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { SafeImage } from '@/components/ui/SafeImage';
import { CupMarkSvg } from '@/components/ui/CupMarkSvg';

export default function OutletsPage() {
  const router = useRouter();
  const { outlet: selectedOutlet, setOutlet, cart, clearCart } = useZechaStore();
  const { showToast } = useToast();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSwitchOutlet, setPendingSwitchOutlet] = useState<Outlet | null>(null);
  const [, setClockTick] = useState(0);

  const selectedOutletRef = useRef<Outlet | null>(selectedOutlet);
  selectedOutletRef.current = selectedOutlet;

  const loadOutlets = useCallback(
    async (isBackground = false) => {
      try {
        if (!isBackground) {
          setLoading(true);
        }
        const data = await getOutlets();
        setOutlets(data);

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

        <h1 className="font-display text-[30px] font-extrabold text-[#2B1A12] leading-[1.15] mb-4 tracking-tight">
          Choose your<br />outlet
        </h1>

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
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-scroll px-5 pt-2 pb-[calc(40px+env(safe-area-inset-bottom))] space-y-[14px]"
      >
        {loading ? (
          [1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-[120px] rounded-[22px] bg-[#F4E7CC]/40 border border-[#EADFC7] animate-pulse"
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
          processedOutlets.map((item) => {
            const isSelected = selectedOutlet?.id === item.id;
            const isClosed = !item.isOpen;

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(item);
                  }
                }}
                aria-disabled={isClosed}
                className={`w-full rounded-[22px] p-4 border transition-all duration-150 ${
                  isClosed
                    ? 'opacity-[0.6] bg-[#FFFEF7]/60 border-[#EADFC7] cursor-not-allowed'
                    : isSelected
                    ? 'bg-[#FFFEF7] border-2 border-[#CE5535] shadow-[0_4px_20px_rgba(206,85,53,0.12)] cursor-pointer'
                    : 'bg-[#FFFEF7] border-[#EADFC7] hover:border-[#E3D7BC] shadow-xs cursor-pointer'
                }`}
              >
                {/* Top card row: Cup tile, name, address, radio circle */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-[52px] h-[52px] rounded-[16px] flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-[#CE5535]' : 'bg-[#F4E7CC]'
                      }`}
                    >
                      <CupMarkSvg
                        variant={isSelected ? 'cream' : 'orange'}
                        className="w-7 h-7"
                        aria-hidden={true}
                      />
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-[17px] font-extrabold text-[#2B1A12] leading-tight">
                        {item.name}
                      </h2>
                      <p className="text-[13px] text-[#75604F] mt-0.5 font-medium leading-tight">
                        {item.address || 'Kerala'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 shrink-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-[#CE5535] text-white shadow-xs'
                          : 'border-2 border-[#EADFC7]'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>

                {/* Bottom Chips Row */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.isOpen
                        ? 'bg-[#2F7A3E]/10 text-[#2F7A3E]'
                        : 'bg-[#BA1A1A]/10 text-[#BA1A1A]'
                    }`}
                  >
                    {item.openStatusText}
                  </span>

                  {item.isOpen && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F4E7CC] text-[#2B1A12]">
                      {item.readyTime}
                    </span>
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
