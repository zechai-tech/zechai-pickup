'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  const pathname = usePathname();
  const isPortal = pathname?.startsWith('/admin') || pathname === '/login' || pathname === '/orders';

  // Admin panel, staff portal login and orders screen are responsive
  if (isPortal) {
    return <div className="min-h-screen bg-cream text-espresso w-full flex flex-col">{children}</div>;
  }

  // Customer app is strictly mobile-first centered inside the 390x844 phone frame on desktop
  return (
    <div className="min-h-screen bg-[#EFE5D0] flex justify-center items-center md:py-6 selection:bg-orange/20 overflow-x-hidden">
      <div className="w-full h-[100dvh] md:w-[390px] md:h-[844px] md:max-h-[844px] md:rounded-[44px] bg-cream shadow-2xl relative flex flex-col overflow-hidden border-border/70 md:border">
        {children}
      </div>
    </div>
  );
}
