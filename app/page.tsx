'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

export default function WelcomePage() {
  const router = useRouter();
  const { activeOrder } = useZechaStore();
  const { showToast } = useToast();

  const handleTrackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const storedCode =
      localStorage.getItem('activeOrderCode') ||
      sessionStorage.getItem('activeOrderCode') ||
      activeOrder?.code;

    if (storedCode) {
      router.push(`/track-order?code=${storedCode}`);
    } else {
      showToast('No active order. Please place an order first.', 'info');
    }
  };

  return (
    <div className="min-h-[100dvh] h-full flex flex-col items-center justify-between px-6 py-6 sm:py-8 bg-[#FDFBEA] page-transition overflow-y-auto overflow-x-hidden scrollbar-none w-full max-w-full">
      {/* Top section: hero collage (scaled so button is never cut off) */}
      <div className="flex-1 w-full flex items-center justify-center py-2 relative min-h-[180px] max-h-[260px]">
        {/* Soft circle backdrop */}
        <div className="w-[200px] h-[200px] sm:w-[230px] sm:h-[230px] rounded-full bg-[#F4E7CC]/80 absolute -z-0 blur-[0.5px]" />

        {/* Collage elements */}
        <div className="relative z-10 w-[260px] h-[210px] sm:w-[280px] sm:h-[230px]">
          {/* Iced Tea glasses (center) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[150px] h-[170px] sm:w-[170px] sm:h-[190px]">
            <Image
              src="/assets/iced.png"
              alt="Zécha Iced Coolers"
              fill
              sizes="170px"
              className="object-contain drop-shadow-md"
              priority
            />
          </div>

          {/* Fried Chicken (bottom left) */}
          <div className="absolute left-1 bottom-1 w-[90px] h-[85px] sm:w-[100px] sm:h-[95px] transform -rotate-6">
            <Image
              src="/assets/chicken.png"
              alt="Crispy Fried Chicken"
              fill
              sizes="100px"
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>

          {/* Loaded Fries Bucket (bottom right) */}
          <div className="absolute right-1 bottom-0 w-[95px] h-[115px] sm:w-[105px] sm:h-[125px]">
            <Image
              src="/assets/loaded-cup.png"
              alt="Loaded Fries Cup"
              fill
              sizes="105px"
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>
        </div>
      </div>

      {/* Bottom section: logo, tagline, badges, CTA button */}
      <div className="w-full max-w-xs flex flex-col items-center gap-3 pb-3 shrink-0">
        {/* Brand Logo */}
        <div className="relative w-[160px] h-[58px] sm:w-[180px] sm:h-[64px]">
          <Image
            src="/assets/logo-orange.png"
            alt="Zécha! One cup every day"
            fill
            sizes="180px"
            className="object-contain"
            priority
          />
        </div>

        {/* Tagline */}
        <p className="text-center text-xs sm:text-sm text-[#75604F] font-medium leading-relaxed max-w-[280px]">
          Skip the queue. Order ahead, pay online and collect it hot the moment it is ready.
        </p>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-1.5 my-0.5">
          <span className="px-3 py-1 rounded-full border border-[#EADFC7] text-xs font-semibold text-[#2B1A12] bg-[#FFFEF7]">
            Ready in 15-20 min
          </span>
          <span className="px-3 py-1 rounded-full border border-[#EADFC7] text-xs font-semibold text-[#2B1A12] bg-[#FFFEF7]">
            Pay via UPI
          </span>
          <span className="px-3 py-1 rounded-full border border-[#EADFC7] text-xs font-semibold text-[#2B1A12] bg-[#FFFEF7]">
            Live order status
          </span>
        </div>

        {/* CTA Button — always 100% visible */}
        <Link href="/outlet" className="w-full pt-1">
          <button className="w-full py-3.5 sm:py-4 bg-[#CE5535] text-white font-bold rounded-2xl text-base sm:text-lg hover:bg-[#A8401F] transition-colors shadow-orange active:scale-[0.98]">
            Order now →
          </button>
        </Link>

        {/* Track order link */}
        <div className="text-center pt-0.5">
          <button
            onClick={handleTrackClick}
            className="text-xs sm:text-sm font-semibold text-[#75604F] hover:text-[#CE5535] transition-colors py-1 cursor-pointer"
          >
            Already ordered?{' '}
            <span className="text-[#CE5535] underline decoration-[#CE5535]/40 underline-offset-4">
              Track my order
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
