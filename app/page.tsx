'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { ArrowRight } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const { activeOrder } = useZechaStore();
  const { showToast } = useToast();

  const handleTrackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (activeOrder) {
      router.push('/track');
    } else {
      showToast('No active order. Please place an order first.', 'info');
    }
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between p-6 pb-8 page-transition bg-cream min-h-full overflow-hidden">
      {/* Pattern overlay at top */}
      <div className="absolute inset-0 top-0 h-[45%] pointer-events-none opacity-25 overflow-hidden">
        <Image
          src="/assets/pattern.jpg"
          alt="Zécha pattern"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cream/60 to-cream" />
      </div>

      {/* Hero Visual Collage */}
      <div className="relative pt-6 pb-2 flex items-center justify-center">
        {/* Soft circle backdrop */}
        <div className="w-[260px] h-[260px] rounded-full bg-[#F4E7CC]/80 absolute -z-0 blur-[0.5px]" />

        {/* Collage elements */}
        <div className="relative z-10 w-[300px] h-[270px]">
          {/* Iced Tea glasses (center) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1 w-[190px] h-[210px]">
            <Image
              src="/assets/iced.png"
              alt="Zécha Iced Coolers"
              fill
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>

          {/* Fried Chicken (bottom left) */}
          <div className="absolute -left-2 bottom-3 w-[115px] h-[105px] transform -rotate-6">
            <Image
              src="/assets/chicken.png"
              alt="Crispy Fried Chicken"
              fill
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>

          {/* Loaded Fries Bucket (bottom right) */}
          <div className="absolute -right-2 bottom-1 w-[120px] h-[145px]">
            <Image
              src="/assets/loaded-cup.png"
              alt="Loaded Fries Cup"
              fill
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>
        </div>
      </div>

      {/* Brand & Content Section */}
      <div className="relative z-10 flex flex-col items-center text-center mt-2 px-2">
        {/* Brand Logo */}
        <div className="relative w-[190px] h-[72px] mb-4">
          <Image
            src="/assets/logo-orange.png"
            alt="Zécha! One cup every day"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Tagline */}
        <p className="text-[16px] leading-[1.4] text-espresso/85 font-medium max-w-[310px] mb-6">
          Skip the queue. Order ahead, pay online and collect it hot the moment it is ready.
        </p>

        {/* Feature chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-[320px] mb-8">
          <span className="px-3.5 py-1.5 rounded-full bg-sand text-espresso font-semibold text-xs tracking-wide">
            Ready in 15-20 min
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-sand text-espresso font-semibold text-xs tracking-wide">
            Pay via UPI
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-sand text-espresso font-semibold text-xs tracking-wide">
            Live order status
          </span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="relative z-10 w-full space-y-4 safe-bottom">
        <Link href="/outlet" className="block w-full">
          <Button className="w-full text-[17px] font-bold group shadow-orange">
            <span>Start your order</span>
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>

        <div className="text-center">
          <button
            onClick={handleTrackClick}
            className="text-sm font-semibold text-espresso hover:text-orange transition-colors py-1 cursor-pointer"
          >
            Already ordered? <span className="text-orange underline decoration-orange/40 underline-offset-4">Track my order</span>
          </button>
        </div>
      </div>
    </div>
  );
}
