'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  const pathname = usePathname();
  const isPortal =
    pathname?.startsWith('/admin') ||
    pathname === '/login' ||
    pathname?.startsWith('/staff') ||
    pathname === '/orders';

  // Admin panel, staff portal login and orders screen are responsive
  if (isPortal) {
    return <div className="min-h-screen bg-cream text-espresso w-full flex flex-col">{children}</div>;
  }

  // Customer app: full 100dvh on mobile, centered 390x844 phone frame on desktop
  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-cream md:bg-[#EFE5D0] flex justify-center items-center md:py-6 selection:bg-orange/20 overflow-hidden w-full max-w-[100vw]">
      <div className="w-full h-full md:w-[390px] md:max-w-[390px] md:h-[844px] md:max-h-[844px] md:rounded-[44px] bg-cream md:shadow-2xl relative flex flex-col overflow-hidden border-border/70 md:border">
        {children}
      </div>
    </div>
  );
}
