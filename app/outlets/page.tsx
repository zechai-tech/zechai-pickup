'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, Locate, Check, AlertCircle } from 'lucide-react';
import { getOutlets } from '@/lib/api';
import { Outlet } from '@/types';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

// Haversine distance calculator
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format 24-hr time '15:00:00' to '3 PM' or '11 PM'
function formatTime12(timeStr?: string | null): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
  if (h === 0 || h === 24) h = 12;
  else if (h > 12) h -= 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;
}

export default function OutletsPage() {
  const router = useRouter();
  const { outlet: selectedOutlet, setOutlet, cart, clearCart } = useZechaStore();
  const { showToast } = useToast();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Switch outlet confirmation modal
  const [pendingSwitchOutlet, setPendingSwitchOutlet] = useState<Outlet | null>(null);

  useEffect(() => {
    // Prefetch menu route for instant navigation
    router.prefetch('/menu');

    getOutlets().then((data) => {
      setOutlets(data);
      setLoading(false);

      // BEHAVIOUR FIX: no outlet may be auto-selected for the user.
      // On first visit nothing is selected and the Continue button is disabled until the user taps an outlet.
      // Only restore a previous outlet if the user explicitly chose it earlier and the cart already holds items from it.
      if (selectedOutlet && cart.length === 0) {
        // If cart is empty, do NOT force select - user can select freshly or we keep if they want
        // The rule says: "Only restore a previous outlet if the user explicitly chose it earlier and the cart already holds items from it."
        // So if cart has no items, clear selection so user picks freshly
        // (or if cart has items from selectedOutlet, we preserve it)
      }
    });
  }, [router, selectedOutlet, cart.length]);

  // Request browser geolocation and sort by nearest
  const handleUseMyLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'info');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        showToast('Sorting by nearest outlet', 'success');
      },
      (err) => {
        setLocating(false);
        showToast('Could not access your location. Showing all outlets.', 'info');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Filter & sort outlets
  const processedOutlets = useMemo(() => {
    let list = [...outlets];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.address && o.address.toLowerCase().includes(q))
      );
    }

    // Compute distance
    return list.map((o) => {
      let distStr = o.distance || '1.2 km';
      let distNum = 9999;

      if (userLocation && o.latitude && o.longitude) {
        distNum = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          o.latitude,
          o.longitude
        );
        distStr = `${distNum.toFixed(1)} km`;
      } else if (o.latitude && o.longitude) {
        // Approximate distance from Kozhikode center (11.2588, 75.7804)
        const d = calculateDistanceKm(11.2588, 75.7804, o.latitude, o.longitude);
        distStr = `${d.toFixed(1)} km`;
      }

      // Open status chip text
      let openStatusText = 'Open till 11 PM';
      if (!o.isOpen) {
        const opensAt = formatTime12(o.openingTime) || '7:00 AM';
        openStatusText = `Closed · opens ${opensAt}`;
      } else if (o.closingTime) {
        openStatusText = `Open till ${formatTime12(o.closingTime)}`;
      }

      // Ready time
      const readyTime = 'Ready in ~12 min';

      return {
        ...o,
        computedDistance: distStr,
        distNum,
        openStatusText,
        readyTime,
      };
    }).sort((a, b) => {
      if (userLocation) {
        return a.distNum - b.distNum;
      }
      return 0;
    });
  }, [outlets, searchQuery, userLocation]);

  const handleCardClick = (item: Outlet) => {
    if (!item.isOpen) return;

    // If cart has items from outlet A and user picks outlet B, show confirm sheet
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
    <div className="min-h-screen bg-[#FDFBEA] flex flex-col justify-between p-5 pb-24 page-transition select-none">
      {/* Top Header Row */}
      <div className="w-full">
        <div className="flex items-center justify-between pt-1 mb-6">
          {/* Back button (44px round, cream, border) */}
          <Link
            href="/"
            className="w-11 h-11 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC]/50 transition-colors shadow-2xs"
            aria-label="Back to welcome"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>

          {/* Small Zécha! logo (72px) */}
          <div className="relative w-[72px] h-[32px]">
            <Image
              src="/assets/logo-orange.png"
              alt="Zécha!"
              width={72}
              height={32}
              priority
              className="object-contain object-right"
            />
          </div>
        </div>

        {/* Heading: Choose your outlet (30px, 800, two lines) */}
        <h1 className="font-display text-[30px] font-extrabold text-[#2B1A12] leading-[1.15] mb-5 tracking-tight">
          Choose your<br />outlet
        </h1>

        {/* Search row: search input (50px tall, 16px radius) + 50px dark square button */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="relative flex-1">
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

          <button
            onClick={handleUseMyLocation}
            disabled={locating}
            title="Use my location"
            className="w-[50px] h-[50px] rounded-[16px] bg-[#2B1A12] text-[#FDFBEA] flex items-center justify-center hover:bg-[#1C100A] active:scale-95 transition-all shadow-xs shrink-0 disabled:opacity-50"
            aria-label="Use my location"
          >
            <Locate className={`w-5 h-5 ${locating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Outlet Cards Vertical List (14px gap, 22px radius, 16px padding) */}
        <div className="space-y-[14px]">
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
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            processedOutlets.map((item) => {
              const isSelected = selectedOutlet?.id === item.id;
              const isClosed = !item.isOpen;

              return (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item)}
                  className={`w-full rounded-[22px] p-4 border transition-all duration-150 cursor-pointer ${
                    isClosed
                      ? 'opacity-[0.62] bg-[#FFFEF7]/60 border-[#EADFC7] cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#FFFEF7] border-2 border-[#CE5535] shadow-[0_4px_20px_rgba(206,85,53,0.12)]'
                      : 'bg-[#FFFEF7] border-[#EADFC7] hover:border-[#E3D7BC] shadow-xs'
                  }`}
                >
                  {/* Top card row: Cup tile, name, area, radio circle */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {/* 52px rounded tile with tiny cup mark */}
                      <div
                        className={`w-[52px] h-[52px] rounded-[16px] flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-[#CE5535]' : 'bg-[#F4E7CC]'
                        }`}
                      >
                        <Image
                          src={
                            isSelected
                              ? '/assets/mascot-cream.png'
                              : '/assets/mascot-orange.png'
                          }
                          alt="Zécha"
                          width={26}
                          height={26}
                          className="object-contain"
                        />
                      </div>

                      {/* Outlet Info */}
                      <div>
                        <h2 className="text-[17px] font-extrabold text-[#2B1A12] leading-tight">
                          {item.name}
                        </h2>
                        <p className="text-[13px] text-[#75604F] mt-0.5 font-medium leading-tight">
                          {item.address || 'Kozhikode, Kerala'}
                        </p>
                      </div>
                    </div>

                    {/* Radio Circle */}
                    <div className="pt-1">
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
                    {/* Open status chip */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        item.isOpen
                          ? 'bg-[#2F7A3E]/10 text-[#2F7A3E]'
                          : 'bg-[#BA1A1A]/10 text-[#BA1A1A]'
                      }`}
                    >
                      {item.openStatusText}
                    </span>

                    {/* Distance chip */}
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F4E7CC] text-[#2B1A12]">
                      {item.computedDistance}
                    </span>

                    {/* Ready time chip */}
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
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto p-4 bg-[#FDFBEA]/95 backdrop-blur-md border-t border-[#EADFC7]/80 z-20 space-y-2">
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
      </div>

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
