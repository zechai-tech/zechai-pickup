'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { getOutlets, getMenu } from '@/lib/api';
import { SafeImage } from '@/components/ui/SafeImage';
import { CupMarkSvg } from '@/components/ui/CupMarkSvg';
import { warmImagesInIdle } from '@/lib/images';

export default function WelcomePage() {
  const router = useRouter();
  const { activeOrder } = useZechaStore();
  const { showToast } = useToast();
  const [anyOutletOpen, setAnyOutletOpen] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    router.prefetch('/outlets');
    router.prefetch('/menu');

    // Check if any outlet is open right now & warm first 8 menu images in idle callback
    getOutlets().then((outlets) => {
      if (outlets && outlets.length > 0) {
        const hasOpen = outlets.some((o) => o.isOpen);
        setAnyOutletOpen(hasOpen);
        const firstOpen = outlets.find((o) => o.isOpen) || outlets[0];
        if (firstOpen?.id) {
          getMenu(firstOpen.id).then((items) => {
            warmImagesInIdle(
              items.slice(0, 8).map((i) => i.image || i.image_url || ''),
              8
            );
          });
        }
      }
    });
  }, [router]);

  const handleTrackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const storedCode =
      (typeof window !== 'undefined' ? sessionStorage.getItem('activeOrderCode') : null) ||
      activeOrder?.code;

    const storedId =
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
    <main
      className="min-h-[100dvh] w-full bg-[#FDFBEA] flex flex-col items-center page-transition select-none"
      style={{
        paddingTop: 'clamp(12px, 3dvh, 26px)',
        paddingLeft: 'clamp(16px, 5vw, 32px)',
        paddingRight: 'clamp(16px, 5vw, 32px)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        gap: 'clamp(8px, 1.5dvh, 16px)',
      }}
    >
      {/* Fluid square hero box: shrinks proportionally on short screens, never pushes content off-screen */}
      <div
        className="relative shrink-0"
        style={{
          width: 'min(100%, 330px, 35dvh)',
          aspectRatio: '1 / 1',
        }}
      >
        {/* Plain Soft Circle Background (#F4E7CC) */}
        <div
          className="rounded-full bg-[#F4E7CC] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: '82%', height: '82%' }}
        />

        {/* Decorative product collage positioned in percentages inside hero box */}
        <div
          className="absolute z-10 transform -rotate-12"
          style={{ left: '2%', top: '38%', width: '42%', height: '40%' }}
        >
          <SafeImage
            src="/assets/chicken.v1.webp"
            alt="Crispy Chicken"
            fill
            sizes="(max-width: 430px) 42vw, 150px"
            priority
            transparent
            className="object-contain drop-shadow-[0_12px_24px_rgba(43,26,18,0.2)]"
          />
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 z-20"
          style={{ top: '4%', width: '58%', height: '72%' }}
        >
          <SafeImage
            src="/assets/iced.v1.webp"
            alt="Zécha Iced Coolers"
            variant="thumb"
            fill
            sizes="(max-width: 430px) 58vw, 210px"
            priority
            transparent
            className="object-contain drop-shadow-[0_16px_32px_rgba(43,26,18,0.25)]"
          />
        </div>

        <div
          className="absolute z-30 transform rotate-8"
          style={{ right: '1%', top: '34%', width: '32%', height: '43%' }}
        >
          <SafeImage
            src="/assets/loaded-cup.v1.webp"
            alt="Loaded Fries"
            fill
            sizes="(max-width: 430px) 32vw, 115px"
            priority
            transparent
            className="object-contain drop-shadow-[0_12px_24px_rgba(43,26,18,0.22)]"
          />
        </div>
      </div>

      {/* Status Pill: Green/red dot + Open now · Pickup only */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFFEF7] border border-[#EADFC7] shadow-xs max-w-full">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            anyOutletOpen ? 'bg-[#2F7A3E]' : 'bg-[#BA1A1A]'
          }`}
        />
        <span
          className="font-bold text-[#2B1A12] leading-tight"
          style={{ fontSize: 'clamp(0.75rem, 3.2vw, 0.85rem)' }}
        >
          {anyOutletOpen ? 'Open now · Pickup only' : 'Closed right now'}
        </span>
      </div>

      {/* Zécha! Logo: rendered with REAL intrinsic aspect ratio (400x201) and height: auto */}
      {logoFailed ? (
        <div className="py-2 flex items-center justify-center">
          <CupMarkSvg variant="orange" className="w-12 h-12" aria-hidden={false} />
        </div>
      ) : (
        <Image
          src="/assets/logo-orange.v1.webp"
          alt="Zécha! One Cup Every Day"
          width={400}
          height={201}
          priority
          unoptimized
          onError={() => setLogoFailed(true)}
          style={{
            width: 'clamp(150px, 52vw, 210px)',
            height: 'auto',
            display: 'block',
          }}
        />
      )}

      {/* Tagline: fluid rem/clamp font size, natural wrap, never overlaps */}
      <p
        className="w-full max-w-[360px] text-center text-[#75604F] font-medium"
        style={{
          fontSize: 'clamp(0.95rem, 3.9vw, 1.125rem)',
          lineHeight: 1.45,
        }}
      >
        Skip the queue. Order ahead, pay online and collect it hot the moment it is ready.
      </p>

      {/* Three white outlined pills */}
      <div className="w-full max-w-[380px] flex flex-wrap items-center justify-center gap-2">
        <span
          className="px-3.5 py-1.5 rounded-full border border-[#EADFC7] font-semibold text-[#2B1A12] bg-[#FFFEF7] shadow-2xs leading-snug"
          style={{ fontSize: 'clamp(0.75rem, 3.2vw, 0.85rem)' }}
        >
          Ready in 15-20 min
        </span>
        <span
          className="px-3.5 py-1.5 rounded-full border border-[#EADFC7] font-semibold text-[#2B1A12] bg-[#FFFEF7] shadow-2xs leading-snug"
          style={{ fontSize: 'clamp(0.75rem, 3.2vw, 0.85rem)' }}
        >
          Pay via UPI
        </span>
        <span
          className="px-3.5 py-1.5 rounded-full border border-[#EADFC7] font-semibold text-[#2B1A12] bg-[#FFFEF7] shadow-2xs leading-snug"
          style={{ fontSize: 'clamp(0.75rem, 3.2vw, 0.85rem)' }}
        >
          Live order status
        </span>
      </div>

      {/* Primary CTA Button: min 56px tall, full width up to 420px, wraps cleanly */}
      <Link
        href="/outlets"
        prefetch={true}
        className="w-full max-w-[420px] min-h-[56px] px-5 py-3 rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-all text-center"
        style={{ fontSize: 'clamp(1rem, 4.3vw, 1.15rem)' }}
      >
        <span>Order now</span>
        <span aria-hidden="true">→</span>
      </Link>

      {/* Already ordered? Track my order */}
      <div
        className="text-center leading-relaxed"
        style={{ fontSize: 'clamp(0.82rem, 3.4vw, 0.95rem)' }}
      >
        <span className="font-semibold text-[#2B1A12]">Already ordered? </span>
        <button
          onClick={handleTrackClick}
          className="font-bold text-[#CE5535] underline hover:text-[#A8401F] transition-colors min-h-[44px] inline-flex items-center"
        >
          Track my order
        </button>
      </div>
    </main>
  );
}
