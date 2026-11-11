'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { getOutlets } from '@/lib/api';

export default function WelcomePage() {
  const router = useRouter();
  const { activeOrder } = useZechaStore();
  const { showToast } = useToast();
  const [anyOutletOpen, setAnyOutletOpen] = useState(true);

  useEffect(() => {
    // Check if any outlet is open right now
    getOutlets().then((outlets) => {
      if (outlets && outlets.length > 0) {
        const hasOpen = outlets.some((o) => o.isOpen);
        setAnyOutletOpen(hasOpen);
      }
    });
  }, []);

  const handleTrackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const storedCode =
      (typeof window !== 'undefined' ? localStorage.getItem('activeOrderCode') : null) ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('activeOrderCode') : null) ||
      activeOrder?.code;

    const storedId =
      (typeof window !== 'undefined' ? localStorage.getItem('activeOrderId') : null) ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('activeOrderId') : null) ||
      activeOrder?.id;

    if (storedCode || storedId) {
      const param = storedId ? `id=${storedId}` : `code=${storedCode}`;
      router.push(`/track-order?${param}`);
    } else {
      showToast('No active order. Please place an order first.', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center px-6 pt-5 pb-8 page-transition select-none">
      {/* Hero area 372px tall: Plain soft circle (#F4E7CC, 280px) centered with 3 product images */}
      <div className="w-full h-[372px] relative flex items-center justify-center shrink-0">
        {/* Soft Circle Background */}
        <div className="w-[280px] h-[280px] rounded-full bg-[#F4E7CC] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-0" />

        {/* Product Collage (Two iced teas center, Crispy chicken left, Loaded fries right) */}
        <div className="relative z-10 w-[320px] h-[340px]">
          {/* Crispy Chicken (Left, rotated -12deg, 140px) */}
          <div className="absolute left-1 top-[135px] w-[140px] h-[135px] transform -rotate-12 z-10">
            <Image
              src="/assets/chicken.png"
              alt="Crispy Chicken"
              width={140}
              height={135}
              priority
              className="object-contain drop-shadow-[0_12px_24px_rgba(43,26,18,0.2)]"
            />
          </div>

          {/* Two Iced Teas (Centre, 198px wide) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-4 w-[198px] h-[240px] z-20">
            <Image
              src="/assets/iced.png"
              alt="Zécha Iced Coolers"
              width={198}
              height={240}
              priority
              className="object-contain drop-shadow-[0_16px_32px_rgba(43,26,18,0.25)]"
            />
          </div>

          {/* Loaded Fries Cup (Right, rotated 8deg, 104px) */}
          <div className="absolute right-0 top-[120px] w-[104px] h-[145px] transform rotate-8 z-30">
            <Image
              src="/assets/loaded-cup.png"
              alt="Loaded Fries"
              width={104}
              height={145}
              priority
              className="object-contain drop-shadow-[0_12px_24px_rgba(43,26,18,0.22)]"
            />
          </div>
        </div>
      </div>

      {/* Directly below hero (no big empty gap) */}
      <div className="w-full flex flex-col items-center text-center mt-1 max-w-[340px]">
        {/* Status Pill: Green dot + Open now · Pickup only */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFFEF7] border border-[#EADFC7] shadow-xs mb-3">
          <span
            className={`w-2 h-2 rounded-full ${
              anyOutletOpen ? 'bg-[#2F7A3E]' : 'bg-[#BA1A1A]'
            }`}
          />
          <span className="text-xs font-bold text-[#2B1A12]">
            {anyOutletOpen ? 'Open now · Pickup only' : 'Closed right now'}
          </span>
        </div>

        {/* Zécha! Logo (200px wide) */}
        <div className="relative w-[200px] h-[68px] mb-3">
          <Image
            src="/assets/logo-orange.png"
            alt="Zécha! One Cup Every Day"
            width={200}
            height={68}
            priority
            className="object-contain"
          />
        </div>

        {/* Tagline (16px, muted #75604F, centred) */}
        <p className="text-[16px] text-[#75604F] font-medium leading-[1.4] mb-4">
          Skip the queue. Order ahead, pay online and collect it hot the moment it is ready.
        </p>

        {/* Three white outlined pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <span className="px-3.5 py-1.5 rounded-full border border-[#EADFC7] text-[13px] font-semibold text-[#2B1A12] bg-[#FFFEF7] shadow-2xs">
            Ready in 15-20 min
          </span>
          <span className="px-3.5 py-1.5 rounded-full border border-[#EADFC7] text-[13px] font-semibold text-[#2B1A12] bg-[#FFFEF7] shadow-2xs">
            Pay via UPI
          </span>
          <span className="px-3.5 py-1.5 rounded-full border border-[#EADFC7] text-[13px] font-semibold text-[#2B1A12] bg-[#FFFEF7] shadow-2xs">
            Live order status
          </span>
        </div>

        {/* 20px below pills: CTA button (58px tall, 20px radius, accent bg #CE5535, cream text, soft shadow) */}
        <div className="w-full space-y-3.5">
          <Link
            href="/outlets"
            prefetch={true}
            className="w-full h-[58px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[17px] flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-all"
          >
            <span>Order now</span>
            <span className="text-xl">→</span>
          </Link>

          {/* Already ordered? Track my order (underlined accent) */}
          <div>
            <span className="text-sm font-semibold text-[#2B1A12]">
              Already ordered?{' '}
            </span>
            <button
              onClick={handleTrackClick}
              className="text-sm font-bold text-[#CE5535] underline hover:text-[#A8401F] transition-colors"
            >
              Track my order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
